import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { ENDPOINT_MESSAGE_RECEIVED, NON_PARTICIPANT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import { TRANSCRIBER_ID } from '../base/participants/constants';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { getLocalTranslationPreferences, isVoiceTranslationEnabled } from '../voice-translation/functions';
import { toBaseVoiceLanguage } from '../voice-translation/languages';

import {
    SET_REQUESTING_SUBTITLES,
    SET_SUBTITLES_LANGUAGE,
    TOGGLE_REQUESTING_SUBTITLES
} from './actionTypes';
import {
    removeCachedTranscriptMessage,
    removeTranscriptMessage,
    storeSubtitle,
    updateTranscriptMessage
} from './actions.any';
import { notifyTranscriptionChunkReceived } from './functions';
import { areClosedCaptionsEnabled, isCCTabEnabled } from './functions.any';
import { ISubtitle, ITranscriptMessage } from './types';

/**
 * The type of json-message which indicates that json carries a
 * transcription result.
 */
const JSON_TYPE_TRANSCRIPTION_RESULT = 'transcription-result';

/**
 * The type of json-message which indicates that json carries a
 * translation result.
 */
const JSON_TYPE_TRANSLATION_RESULT = 'translation-result';

/**
 * The local participant property which is used to store the language
 * preference for translation for a participant.
 */
const P_NAME_TRANSLATION_LANGUAGE = 'translation_language';

/**
* Time after which the rendered subtitles will be removed.
*/
const REMOVE_AFTER_MS = 3000;

/**
 * Stability factor for a transcription. We'll treat a transcript as stable
 * beyond this value.
 */
const STABLE_TRANSCRIPTION_FACTOR = 0.85;

const ttsRequestedIds = new Map<string, number>();
const TTS_REQUEST_CACHE_LIMIT = 2000;
const TTS_REQUEST_TTL_MS = 5 * 60 * 1000;

function getLocalParticipantId(state: any) {
    return state?.['features/base/participants']?.local?.id;
}

function normalizeLanguageCode(language?: string | null) {
    return toBaseVoiceLanguage(language).toLowerCase();
}

function markTtsRequested(id: string) {
    ttsRequestedIds.set(id, Date.now());

    if (ttsRequestedIds.size <= TTS_REQUEST_CACHE_LIMIT) {
        return;
    }

    const now = Date.now();

    for (const [ key, timestamp ] of ttsRequestedIds.entries()) {
        if (now - timestamp > TTS_REQUEST_TTL_MS) {
            ttsRequestedIds.delete(key);
        }
    }
}

function maybeRequestVoiceTranslationAudio(
        store: IStore,
        messageId: string,
        participantId: string,
        text?: string,
        language?: string,
        needsTranslation = false) {
    const state = store.getState();

    if (!text?.trim()
        || !isVoiceTranslationEnabled(state)
        || participantId === getLocalParticipantId(state)) {
        return;
    }

    const preferences = getLocalTranslationPreferences(state);
    const targetLanguage = preferences.toLanguage;
    const targetBaseLanguage = normalizeLanguageCode(targetLanguage);
    const payloadLanguage = normalizeLanguageCode(language);

    if (preferences.dontTranslate || !targetLanguage || !targetBaseLanguage) {
        return;
    }

    if (!needsTranslation && payloadLanguage && payloadLanguage !== targetBaseLanguage) {
        return;
    }

    const requestKey = `${messageId}:${targetBaseLanguage}`;

    if (ttsRequestedIds.has(requestKey)) {
        return;
    }

    const requestTts = globalThis.__melp_tts_request__;

    if (!requestTts) {
        return;
    }

    requestTts({
        text: text.trim(),
        language: targetLanguage,
        sourceLanguage: language,
        participantId,
        messageId,
        needsTranslation
    });
    markTtsRequested(requestKey);
}

/**
 * Middleware that catches actions related to transcript messages to be rendered
 * in {@link Captions}.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {
    case ENDPOINT_MESSAGE_RECEIVED:
    case NON_PARTICIPANT_MESSAGE_RECEIVED:
        return _endpointMessageReceived(store, next, action);

    case TOGGLE_REQUESTING_SUBTITLES: {
        const state = store.getState()['features/subtitles'];
        const toggledValue = !state._requestingSubtitles;

        _requestingSubtitlesChange(store, toggledValue, state._language);
        break;
    }
    case SET_REQUESTING_SUBTITLES:
        _requestingSubtitlesChange(store, action.enabled, action.language);
        break;

    case SET_SUBTITLES_LANGUAGE: {
        const { conference } = store.getState()['features/base/conference'];

        conference?.setLocalParticipantProperty(
            P_NAME_TRANSLATION_LANGUAGE,
            action.language ? action.language.replace('translation-languages:', '') : '');
        break;
    }
    }

    return next(action);
});

/**
 * Notifies the feature transcription that the action
 * {@code ENDPOINT_MESSAGE_RECEIVED} is being dispatched within a specific redux
 * store.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to
 * dispatch the specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code ENDPOINT_MESSAGE_RECEIVED}
 * which is being dispatched in the specified {@code store}.
 * @private
 * @returns {Object} The value returned by {@code next(action)}.
 */
function _endpointMessageReceived(store: IStore, next: Function, action: AnyAction) {
    let json: any = {};

    if (action.type === ENDPOINT_MESSAGE_RECEIVED) {
        if (!action.participant.isHidden()) {
            return next(action);
        }
        json = action.data;
    } else if (action.type === NON_PARTICIPANT_MESSAGE_RECEIVED && action.id === TRANSCRIBER_ID) {
        json = action.json;
    } else {
        return next(action);
    }

    if (![ JSON_TYPE_TRANSCRIPTION_RESULT, JSON_TYPE_TRANSLATION_RESULT ].includes(json?.type)) {
        return next(action);
    }

    const { dispatch, getState } = store;
    const state = getState();
    const _areClosedCaptionsEnabled = areClosedCaptionsEnabled(store.getState());
    const transcriptMessageID = json.message_id;
    const { name, id, avatar_url: avatarUrl } = json.participant;
    const participant = {
        avatarUrl,
        id,
        name
    };
    const { timestamp } = json;
    const participantId = participant.id;

    // Handle transcript messages
    const language = state['features/base/conference'].conference
        ?.getLocalParticipantProperty(P_NAME_TRANSLATION_LANGUAGE);
    const { dumpTranscript, skipInterimTranscriptions } = state['features/base/config'].testing ?? {};

    let newTranscriptMessage: ITranscriptMessage | undefined;

    if (json.type === JSON_TYPE_TRANSLATION_RESULT) {
        if (!_areClosedCaptionsEnabled) {
            // If closed captions are not enabled, bail out.
            maybeRequestVoiceTranslationAudio(
                store,
                transcriptMessageID,
                participantId,
                json.text?.trim(),
                json.language,
                false
            );

            return next(action);
        }

        const translation = json.text?.trim();

        maybeRequestVoiceTranslationAudio(
            store,
            transcriptMessageID,
            participantId,
            translation,
            json.language,
            false
        );

        if (isCCTabEnabled(state)) {
            dispatch(storeSubtitle({
                id: transcriptMessageID,
                interim: Boolean(json.is_interim),
                isTranscription: false,
                language: json.language,
                participantAvatarUrl: avatarUrl,
                participantId,
                participantName: name,
                text: translation,
                timestamp
            }));

            return next(action);
        }

        if (json.language === language) {
            // Displays final results in the target language if translation is
            // enabled.
            newTranscriptMessage = {
                clearTimeOut: undefined,
                final: json.text?.trim(),
                participant
            };
        }
    } else if (json.type === JSON_TYPE_TRANSCRIPTION_RESULT) {
        const isInterim = json.is_interim;

        // Displays interim and final results without any translation if
        // translations are disabled.

        const { text } = json.transcript[0];

        if (!isInterim) {
            maybeRequestVoiceTranslationAudio(
                store,
                transcriptMessageID,
                participantId,
                text,
                json.language,
                normalizeLanguageCode(json.language)
                    !== normalizeLanguageCode(getLocalTranslationPreferences(state).toLanguage)
            );
        }

        // First, notify the external API.
        if (!(isInterim && skipInterimTranscriptions)) {
            const txt: any = {};

            if (!json.is_interim) {
                txt.final = text;
            } else if (json.stability > STABLE_TRANSCRIPTION_FACTOR) {
                txt.stable = text;
            } else {
                txt.unstable = text;
            }

            notifyTranscriptionChunkReceived(
                transcriptMessageID,
                json.language,
                participant,
                txt,
                store
            );

            if (navigator.product !== 'ReactNative') {

                // Dump transcript in a <transcript> element for debugging purposes.
                if (!json.is_interim && dumpTranscript) {
                    try {
                        let elem = document.body.getElementsByTagName('transcript')[0];

                        // eslint-disable-next-line max-depth
                        if (!elem) {
                            elem = document.createElement('transcript');
                            document.body.appendChild(elem);
                        }

                        elem.append(`${new Date(json.timestamp).toISOString()} ${participant.name}: ${text}`);
                    } catch (_) {
                        // Ignored.
                    }
                }
            }
        }

        if (!_areClosedCaptionsEnabled) {
            // If closed captions are not enabled, bail out.
            return next(action);
        }

        const subtitle: ISubtitle = {
            id: transcriptMessageID,
            participantId,
            participantName: name,
            participantAvatarUrl: avatarUrl,
            language: json.language,
            text,
            interim: isInterim,
            timestamp,
            isTranscription: true
        };

        if (isCCTabEnabled(state)) {
            dispatch(storeSubtitle(subtitle));

            return next(action);
        }

        // If the user is not requesting transcriptions just bail.
        // Regex to filter out all possible country codes after language code:
        // this should catch all notations like 'en-GB' 'en_GB' and 'enGB'
        // and be independent of the country code length
        if (!language || (_getPrimaryLanguageCode(json.language) !== _getPrimaryLanguageCode(language))) {
            return next(action);
        }

        if (json.is_interim && skipInterimTranscriptions) {
            return next(action);
        }

        // We update the previous transcript message with the same
        // message ID or adds a new transcript message if it does not
        // exist in the map.
        const existingMessage = state['features/subtitles']._transcriptMessages.get(transcriptMessageID);

        newTranscriptMessage = {
            clearTimeOut: existingMessage?.clearTimeOut,
            participant
        };

        // If this is final result, update the state as a final result
        // and start a count down to remove the subtitle from the state
        if (!json.is_interim) {
            newTranscriptMessage.final = text;
        } else if (json.stability > STABLE_TRANSCRIPTION_FACTOR) {
            // If the message has a high stability, we can update the
            // stable field of the state and remove the previously
            // unstable results
            newTranscriptMessage.stable = text;
        } else {
            // Otherwise, this result has an unstable result, which we
            // add to the state. The unstable result will be appended
            // after the stable part.
            newTranscriptMessage.unstable = text;
        }
    }

    if (newTranscriptMessage) {
        if (newTranscriptMessage.final) {
            const cachedTranscriptMessage
                = state['features/subtitles']._cachedTranscriptMessages?.get(transcriptMessageID);

            if (cachedTranscriptMessage) {
                const cachedText = (cachedTranscriptMessage.stable || cachedTranscriptMessage.unstable)?.trim();
                const newText = newTranscriptMessage.final;

                if (cachedText && cachedText.length > 0 && newText && newText.length > 0
                    && newText.toLowerCase().startsWith(cachedText.toLowerCase())) {
                    newTranscriptMessage.final = newText.slice(cachedText.length)?.trim();
                }
                dispatch(removeCachedTranscriptMessage(transcriptMessageID));

                if (!newTranscriptMessage.final || newTranscriptMessage.final.length === 0) {
                    return next(action);
                }
            }
        }


        _setClearerOnTranscriptMessage(dispatch, transcriptMessageID, newTranscriptMessage);
        dispatch(updateTranscriptMessage(transcriptMessageID, newTranscriptMessage));
    }

    return next(action);
}

/**
 * Utility function to extract the primary language code like 'en-GB' 'en_GB'
 * 'enGB' 'zh-CN' and 'zh-TW'.
 *
 * @param {string} language - The language to use for translation or user requested.
 * @returns {string}
 */
function _getPrimaryLanguageCode(language: string) {
    return language.replace(/[-_A-Z].*/, '');
}

/**
 * Publishes the translation language this participant reads in.
 *
 * All that is left of what used to be the Jigasi handshake. Captions are produced on the participant's own device now,
 * by the native utterance recorder and the transcription socket, so there is no transcriber to ask Jicofo for, none to
 * dial, and no backend recording metadata to turn on around it. That machinery did not merely go unused on a
 * deployment without a transcriber - the dial rejected, and its failure handler switched the captions back off and
 * raised a "transcribing failed" notification, so the feature died on the spot every time it was switched on.
 *
 * The language stays because it is the participant's own property rather than the transcriber's: the voice
 * translation feature reads it off presence to know what to translate for them.
 *
 * @param {Store} store - The redux store.
 * @param {boolean} enabled - Whether subtitles are on.
 * @param {string} language - The language to translate into.
 * @private
 * @returns {void}
 */
function _requestingSubtitlesChange(
        { getState }: IStore,
        enabled: boolean,
        language?: string | null) {
    if (!enabled) {
        return;
    }

    const { conference } = getState()['features/base/conference'];

    conference?.setLocalParticipantProperty(
        P_NAME_TRANSLATION_LANGUAGE,
        language ? language.replace('translation-languages:', '') : '');
}

/**
 * Set a timeout on a TranscriptMessage object so it clears itself when it's not
 * updated.
 *
 * @param {Function} dispatch - Dispatch remove action to store.
 * @param {string} transcriptMessageID - The id of the message to remove.
 * @param {Object} transcriptMessage - The message to remove.
 * @returns {void}
 */
function _setClearerOnTranscriptMessage(
        dispatch: IStore['dispatch'],
        transcriptMessageID: string,
        transcriptMessage: { clearTimeOut?: number; }) {
    if (transcriptMessage.clearTimeOut) {
        clearTimeout(transcriptMessage.clearTimeOut);
    }

    transcriptMessage.clearTimeOut
        = window.setTimeout(
            () => dispatch(removeTranscriptMessage(transcriptMessageID)),
            REMOVE_AFTER_MS);
}
