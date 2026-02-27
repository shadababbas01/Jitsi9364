import { AnyAction } from 'redux';

import { showErrorNotification } from '../notifications/actions';
import { IStore } from '../app/types';
import { ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import { MEET_FEATURES } from '../base/jwt/constants';
import { isJwtFeatureEnabled } from '../base/jwt/functions';
import JitsiMeetJS from '../base/lib-jitsi-meet';
import {
    CONFERENCE_JOINED,
    NON_PARTICIPANT_MESSAGE_RECEIVED
} from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { PARTICIPANT_ROLE } from '../base/participants/constants';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { TRANSCRIBER_JOINED } from '../transcribing/actionTypes';

import {
    SET_REQUESTING_SUBTITLES,
    TOGGLE_REQUESTING_SUBTITLES
} from './actionTypes';
import {
    removeCachedTranscriptMessage,
    removeTranscriptMessage,
    setRequestingSubtitles,
    setSubtitlesError,
    storeSubtitle,
    updateTranscriptMessage
} from './actions.any';
import { persistSummaryState, readPersistedSummaryState } from './summaryStateStorage';
import { setSummaryCategory, setSummaryEnabled } from './actions.any';
import { notifyTranscriptionChunkReceived } from './functions';
import { areClosedCaptionsEnabled, isCCTabEnabled } from './functions.any';
import logger from './logger';
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
 * Custom data-channel message fired to toggle or sync summary state.
 */
const SUMMARY_CONTROL_MESSAGE = 'cc-summary-control';

/**
 * Custom data-channel message fired after the summary state request is answered.
 */
const SUMMARY_STATE_ACK_MESSAGE = 'cc-summary-state-ack';

/**
 * Custom data-channel message used to request the current summary state
 * from moderators that are already in the meeting.
 */
const SUMMARY_STATE_REQUEST_MESSAGE = 'cc-summary-state-request';

/**
 * The local participant property which is used to set whether the local
 * participant wants to have a transcriber in the room.
 */
const P_NAME_REQUESTING_TRANSCRIPTION = 'requestingTranscription';

/**
 * The local participant property which is used to store the language
 * preference for translation for a participant.
 */
const P_NAME_TRANSLATION_LANGUAGE = 'translation_language';
/**
 * The dial command to use for starting a transcriber.
 */
const TRANSCRIBER_DIAL_NUMBER = 'jitsi_meet_transcribe';

/**
 * The dial command to use for starting a transcriber.
 */

/**
* Time after which the rendered subtitles will be removed.
*/
const REMOVE_AFTER_MS = 3000;

/**
 * Stability factor for a transcription. We'll treat a transcript as stable
 * beyond this value.
 */
const STABLE_TRANSCRIPTION_FACTOR = 0.85;

/**
 * Middleware that catches actions related to transcript messages to be rendered
 * in {@link Captions}.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {
         case CONFERENCE_JOINED: {
        const { conference } = store.getState()['features/base/conference'];
        const {
            _summaryEnabled,
            _summaryCategory,
            _interviewConsent,
            _summaryStateSynced
        } = store.getState()['features/subtitles'];

        if (!_summaryStateSynced) {
            const persisted = readPersistedSummaryState(conference);

            if (persisted?.enabled) {
                store.dispatch(setSummaryEnabled(true));

                if (persisted.category) {
                    store.dispatch(setSummaryCategory(persisted.category));
                }

                persistSummaryState(conference, {
                    enabled: true,
                    category: persisted.category ?? undefined
                });

                sendConferenceMessage(conference, {
                    type: SUMMARY_CONTROL_MESSAGE,
                    enabled: true,
                    category: persisted.category
                }, 'summary control restore');
            }
        }

        try {
            if (_summaryStateSynced && _summaryEnabled) {
                sendConferenceMessage(conference, {
                    type: SUMMARY_CONTROL_MESSAGE,
                    enabled: _summaryEnabled,
                    category: _summaryCategory
                }, 'summary control state');
            }

            if (!_summaryStateSynced) {
                const state = store.getState();
                const requesterId = getLocalParticipantId(state);
                const targetModeratorId = getRemoteModeratorId(state);
                const requestId = `${requesterId || 'local'}-${Date.now()}`;
                const payload = {
                    type: SUMMARY_STATE_REQUEST_MESSAGE,
                    requesterId,
                    requestId
                };

                if (targetModeratorId) {
                    const currentConference = getCurrentConference(state);

                    try {
                        currentConference?.sendEndpointMessage(targetModeratorId, payload);
                    } catch (e) {
                        logger.warn('Failed to send targeted summary state request', e);
                        sendConferenceMessage(conference, payload, 'summary state request fallback');
                    }
                } else {
                    sendConferenceMessage(conference, payload, 'summary state request');
                }
            }

            if (_summaryCategory === 'interview' && typeof _interviewConsent === 'boolean') {
                sendConferenceMessage(conference, {
                    type: 'interview-consent',
                    accepted: _interviewConsent
                }, 'interview consent');
            }
        } catch (e) {
            logger.warn('Failed to send summary state on CONFERENCE_JOINED', e);
        }
        break;
    }
    case NON_PARTICIPANT_MESSAGE_RECEIVED:
        return _nonParticipantMessageReceived(store, next, action);
    case ENDPOINT_MESSAGE_RECEIVED:
        return _endpointMessageReceived(store, next, action);

    case TOGGLE_REQUESTING_SUBTITLES: {
        const state = store.getState()['features/subtitles'];
        const toggledValue = !state._requestingSubtitles;

        _requestingSubtitlesChange(
            store,
            toggledValue,
            state._language,
            undefined,
            state._requestingSubtitles);
        break;
    }
    case TRANSCRIBER_JOINED: {
        const { transcription } = store.getState()['features/base/config'];

        if (transcription?.autoCaptionOnTranscribe) {
            store.dispatch(setRequestingSubtitles(true));
        }

        break;
    }
    case SET_REQUESTING_SUBTITLES:
        _requestingSubtitlesChange(
            store,
            action.enabled,
            action.language,
            action.backendRecordingOn,
            store.getState()['features/subtitles']._requestingSubtitles);
        break;
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
    const { data: json, participant: sender } = action;

    if (_handleSummarySyncPayload(store, json, sender)) {
        return next(action);
    }

    const { dispatch, getState } = store;

    if (![ JSON_TYPE_TRANSCRIPTION_RESULT, JSON_TYPE_TRANSLATION_RESULT ].includes(json?.type)) {
        return next(action);
    }
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

        const newTranscriptMessage = {
            clearTimeOut: undefined,
            final: json.text,
            language: json.language,
            participant
        };

    if (json.type === JSON_TYPE_TRANSLATION_RESULT) {
        if (!_areClosedCaptionsEnabled) {
            // If closed captions are not enabled, bail out.
            return next(action);
        }

        const translation = json.text?.trim();

        if (isCCTabEnabled(state)) {
            dispatch(storeSubtitle({
                participantId,
                text: translation,
                language: json.language,
                interim: false,
                isTranscription: false,
                timestamp,
                id: transcriptMessageID
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
 * Toggle the local property 'requestingTranscription'. This will cause Jicofo
 * and Jigasi to decide whether the transcriber needs to be in the room.
 *
 * @param {Store} store - The redux store.
 * @param {boolean} enabled - Whether subtitles should be enabled or not.
 * @param {string} language - The language to use for translation.
 * @param {boolean} backendRecordingOn - Whether backend recording is on or not.
 * @param {boolean} previouslyRequesting - Whether subtitles were already on.
 * @private
 * @returns {void}
 */
function _requestingSubtitlesChange(
        { dispatch, getState }: IStore,
        enabled: boolean,
        language?: string | null,
        backendRecordingOn = false,
        previouslyRequesting = false) {
    const state = getState();
    const { conference } = state['features/base/conference'];
    const { transcription } = state['features/base/config'];

    conference?.setLocalParticipantProperty(
        P_NAME_REQUESTING_TRANSCRIPTION,
        enabled);
 if (enabled && !previouslyRequesting) {
        const featureAllowed = isJwtFeatureEnabled(state, MEET_FEATURES.TRANSCRIPTION, false);

        if (featureAllowed && (!backendRecordingOn || (transcription?.inviteJigasiOnBackendTranscribing ?? true))) {
            conference?.dial(TRANSCRIBER_DIAL_NUMBER)
                .catch((error: any) => {
                    logger.error('Error dialing for transcription', error);
                    dispatch(setRequestingSubtitles(false, false, null));
                    dispatch(showErrorNotification({
                        titleKey: 'transcribing.failed'
                    }));
                });
        }
    }
    if (enabled && language) {
        conference?.setLocalParticipantProperty(
            P_NAME_TRANSLATION_LANGUAGE,
            language.replace('translation-languages:', ''));
    }
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

function _nonParticipantMessageReceived(store: IStore, next: Function, action: AnyAction & { json: any; }) {
    if (_handleSummarySyncPayload(store, action.json)) {
        return next(action);
    }

    return next(action);
}

function _handleSummarySyncPayload(store: IStore, json?: any, sender?: any) {
    if (json?.type === SUMMARY_STATE_REQUEST_MESSAGE) {
        const state = store.getState();
        const localParticipantId = getLocalParticipantId(state);

        if (sender?.local || (json.requesterId && json.requesterId === localParticipantId)) {
            return true;
        }

        const {
            _summaryEnabled,
            _summaryCategory
        } = state['features/subtitles'];

        const { conference } = state['features/base/conference'];
        const responsePayload = {
            type: SUMMARY_STATE_ACK_MESSAGE,
            enabled: Boolean(_summaryEnabled),
            category: _summaryCategory,
            targetId: json.requesterId,
            requestId: json.requestId,
            responderId: localParticipantId
        };

        let targetedAttempted = false;

        if (json.requesterId && conference?.sendEndpointMessage) {
            targetedAttempted = true;
            try {
                conference.sendEndpointMessage(json.requesterId, responsePayload);
            } catch (e) {
                logger.warn('Failed to send summary ack endpoint message', e);
            }
        }

        sendConferenceMessage(
            conference,
            responsePayload,
            targetedAttempted ? 'summary state ack mirror' : 'summary state ack broadcast');

        return true;
    }

    if (json?.type === SUMMARY_STATE_ACK_MESSAGE) {
        const state = store.getState();
        const localParticipantId = getLocalParticipantId(state);

        if (json.targetId && json.targetId !== localParticipantId) {
            return true;
        }

        const nextEnabled = Boolean(json.enabled);
        const nextCategory = typeof json.category === 'string' ? json.category : undefined;

        store.dispatch(setSummaryEnabled(nextEnabled));

        if (typeof nextCategory === 'string') {
            store.dispatch(setSummaryCategory(nextCategory));
        }

        persistSummaryState(
            state['features/base/conference']?.conference,
            nextEnabled ? {
                enabled: true,
                category: nextCategory
            } : undefined
        );

        return true;
    }

    if (json?.type === SUMMARY_CONTROL_MESSAGE) {
        const conference = store.getState()['features/base/conference']?.conference;
        const currentSummaryState = store.getState()['features/subtitles'];
        const nextEnabled = typeof json.enabled === 'undefined'
            ? currentSummaryState._summaryEnabled
            : Boolean(json.enabled);
        const nextCategory = typeof json.category === 'string'
            ? json.category
            : currentSummaryState._summaryCategory;

        if (typeof json.enabled !== 'undefined') {
            store.dispatch(setSummaryEnabled(nextEnabled));
        }
        if (typeof json.category === 'string') {
            store.dispatch(setSummaryCategory(nextCategory ?? ''));
        }

        persistSummaryState(conference, nextEnabled ? {
            enabled: true,
            category: nextCategory ?? undefined
        } : undefined);

        return true;
    }

    return false;
}

const sendConferenceMessage = (conference: any, message: Record<string, any>, context: string) => {
    if (!conference) {
        return;
    }

    try {
        conference?.sendEndpointMessage?.('', message);
    } catch (e) {
        logger.warn(`Failed to send ${context} via endpoint`, e);
    }

    try {
        conference?.sendMessage?.(message);
    } catch (e) {
        logger.warn(`Failed to send ${context} via MUC`, e);
    }
};

const getLocalParticipantId = (state: any) => state?.['features/base/participants']?.local?.id;

const getRemoteModeratorId = (state: any) => {
    const remoteParticipants: Map<string, any> | undefined = state?.['features/base/participants']?.remote;

    if (!remoteParticipants) {
        return undefined;
    }

    let fallbackParticipantId: string | undefined;

    for (const [ participantId, participant ] of remoteParticipants) {
        if (!participantId) {
            continue;
        }

        fallbackParticipantId = fallbackParticipantId ?? participantId;

        if (participant?.role === PARTICIPANT_ROLE.MODERATOR) {
            return participantId;
        }
    }

    return fallbackParticipantId;
};