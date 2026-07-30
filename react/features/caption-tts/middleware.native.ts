import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import {
    CONFERENCE_FAILED,
    CONFERENCE_LEFT,
    CONFERENCE_PROPERTIES_CHANGED
} from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SETTINGS_UPDATED } from '../base/settings/actionTypes';
import { TRACK_ADDED } from '../base/tracks/actionTypes';
import {
    resetRemoteAudioSilenced,
    setRemoteAudioSilenced,
    silenceNewRemoteAudioTrack
} from '../base/tracks/remoteAudio';
import { APP_STATE_CHANGED } from '../mobile/background/actionTypes';
import { showWarningNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../notifications/constants';
import {
    SET_REQUESTING_SUBTITLES,
    SET_SUBTITLES_LANGUAGE,
    STORE_SUBTITLE,
    UPDATE_TRANSCRIPT_MESSAGE
} from '../subtitles/actionTypes';
import { isLiveCaptionsActive } from '../subtitles/functions.any';
import { normalizeSubtitlesLanguage, translateLiveCaptionTextCached } from '../subtitles/languages';
import { ISubtitle } from '../subtitles/types';
import { TRANSCRIBER_JOINED, TRANSCRIBER_LEFT } from '../transcribing/actionTypes';
import { isVoiceTranslationEnabled } from '../voice-translation/functions';

import { setCaptionTtsSpeaking, setCaptionTtsUnsupportedLanguage } from './actions';
import { SPOKEN_CACHE_LIMIT, SPOKEN_CACHE_TTL_MS } from './constants';
import {
    getCaptionTtsState,
    isCaptionTtsEnabled,
    isCaptionTtsSupported,
    resolveSpokenLanguage,
    toTtsLanguageTag
} from './functions.native';
import logger from './logger';
import CaptionsTtsQueue from './native/CaptionsTtsQueue';

/**
 * The queue feeding the device text-to-speech engine. Created on first use.
 */
let queue: CaptionsTtsQueue | undefined;

/**
 * The IDs of the captions already handed over to the queue, mapped to when that happened. The same utterance can reach
 * us as both a transcription and a translation result, and it must only ever be spoken once.
 */
const spokenMessageIds = new Map<string, number>();

/**
 * Whether this device can read captions aloud at all. Checked once, since the middleware sees every action.
 */
const supported = isCaptionTtsSupported();

/**
 * Identifies this feature to the remote audio silencer, so that turning read aloud off cannot unmute the voices while
 * voice translation is still replacing them.
 */
const CAPTION_TTS_SILENCING_REASON = 'captions-read-aloud';

/**
 * Middleware which reads the live captions aloud through the device text-to-speech engine.
 *
 * It hooks the actions which put a caption on the screen rather than the components rendering them, and translates the
 * text through the same cached helper the caption UI uses, so that what is spoken is what is displayed.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    if (!supported) {
        return next(action);
    }

    switch (action.type) {
    case STORE_SUBTITLE:
        _maybeSpeakSubtitle(store, action.subtitle);
        break;

    case UPDATE_TRANSCRIPT_MESSAGE:
        _maybeSpeakStageCaption(store, action.transcriptMessageID, action.newTranscriptMessage?.final);
        break;

    case SETTINGS_UPDATED: {
        if (typeof action.settings?.readCaptionsAloud !== 'boolean') {
            break;
        }

        const result = next(action);

        _syncEnabledState(store);

        return result;
    }

    case SET_SUBTITLES_LANGUAGE: {
        const result = next(action);

        // The captions carry on in a different language, so whatever is queued is stale.
        _getQueue(store).flush();
        _checkLanguageAvailability(store);

        return result;
    }

    case SET_REQUESTING_SUBTITLES: {
        const result = next(action);

        if (!action.enabled) {
            _getQueue(store).flush();
        } else {
            _checkLanguageAvailability(store);
        }

        _syncRemoteAudio(store);

        return result;
    }

    case TRANSCRIBER_JOINED:

    // Transcription can also start without the transcriber joining as a participant, and it is already running when
    // joining a meeting which has captions on, so the conference properties are the other signal to watch.
    case CONFERENCE_PROPERTIES_CHANGED: {
        const result = next(action);

        _syncRemoteAudio(store);

        return result;
    }

    case TRANSCRIBER_LEFT: {
        const result = next(action);

        _getQueue(store).flush();

        // Without captions there is nothing to read aloud, so the participants must be audible again.
        _syncRemoteAudio(store);

        return result;
    }

    case TRACK_ADDED:
        silenceNewRemoteAudioTrack(action.track);
        break;

    case APP_STATE_CHANGED: {
        const result = next(action);

        if (action.appState === 'active') {
            _syncRemoteAudio(store);
        } else {
            // Nothing is read aloud in the background, so the participants have to be audible again.
            _getQueue(store).flush();
            setRemoteAudioSilenced(store.getState(), CAPTION_TTS_SILENCING_REASON, false);
        }

        return result;
    }

    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT:
        spokenMessageIds.clear();
        queue?.destroy();
        queue = undefined;
        resetRemoteAudioSilenced();
        break;
    }

    return next(action);
});

/**
 * Returns the speech queue, creating it if necessary.
 *
 * @param {IStore} store - The redux store.
 * @returns {CaptionsTtsQueue}
 */
function _getQueue({ dispatch }: IStore): CaptionsTtsQueue {
    if (!queue) {
        queue = new CaptionsTtsQueue(
            (speaking, messageId) => dispatch(setCaptionTtsSpeaking(speaking, messageId)));
    }

    return queue;
}

/**
 * Turns the queue on or off to match the current setting.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncEnabledState(store: IStore) {
    const enabled = isCaptionTtsEnabled(store.getState());

    _getQueue(store).setEnabled(enabled);

    if (enabled) {
        _checkLanguageAvailability(store);
    } else {
        store.dispatch(setCaptionTtsUnsupportedLanguage(null));
    }

    _syncRemoteAudio(store);
}

/**
 * Silences the voices of the remote participants while their captions are being read aloud, and restores them
 * afterwards.
 *
 * The remote voices are only silenced while captions are actually flowing and the device can speak them, so that
 * turning the setting on can never leave the local user with a meeting they can neither hear nor read.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncRemoteAudio(store: IStore) {
    const state = store.getState();
    const shouldSilence = _shouldSpeak(store)
        && isLiveCaptionsActive(state)
        && !getCaptionTtsState(state).unsupportedLanguage;

    setRemoteAudioSilenced(state, CAPTION_TTS_SILENCING_REASON, shouldSilence);
}

/**
 * Warns the local user once when the device has no voice for the caption language they picked. Android ships voices for
 * a limited set of languages and the rest have to be downloaded, so this is a common case rather than an edge case.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _checkLanguageAvailability(store: IStore) {
    const { dispatch, getState } = store;
    const state = getState();

    if (!isCaptionTtsEnabled(state)) {
        return;
    }

    const selectedLanguage = normalizeSubtitlesLanguage(state['features/subtitles']._language);

    if (!selectedLanguage) {
        // No caption language was picked, so captions are spoken in whichever language they were transcribed in and
        // there is nothing to check up front.
        dispatch(setCaptionTtsUnsupportedLanguage(null));

        return;
    }

    const languageTag = toTtsLanguageTag(selectedLanguage);

    _getQueue(store).isLanguageAvailable(languageTag).then(available => {
        dispatch(setCaptionTtsUnsupportedLanguage(available ? null : selectedLanguage));

        if (!available) {
            dispatch(showWarningNotification({
                descriptionKey: 'captionTts.languageUnavailableDescription',
                titleKey: 'captionTts.languageUnavailable'
            }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
        }

        // Whether the remote voices may be silenced depends on the answer.
        _syncRemoteAudio(store);
    });
}

/**
 * Remembers that a caption was spoken and keeps the bookkeeping from growing without bounds.
 *
 * @param {string} messageId - The ID of the caption.
 * @returns {boolean} - Whether the caption is new, i.e. has to be spoken.
 */
function _claimMessage(messageId: string): boolean {
    if (spokenMessageIds.has(messageId)) {
        return false;
    }

    const now = Date.now();

    spokenMessageIds.set(messageId, now);

    if (spokenMessageIds.size > SPOKEN_CACHE_LIMIT) {
        for (const [ id, timestamp ] of spokenMessageIds.entries()) {
            if (now - timestamp > SPOKEN_CACHE_TTL_MS) {
                spokenMessageIds.delete(id);
            }
        }
    }

    return true;
}

/**
 * Returns whether a caption should be read aloud at all.
 *
 * @param {IStore} store - The redux store.
 * @returns {boolean}
 */
function _shouldSpeak({ getState }: IStore): boolean {
    const state = getState();

    // The voice translation feature speaks the remote participant through its own server side engine, so letting the
    // device engine speak as well would say everything twice.
    return isCaptionTtsEnabled(state) && !isVoiceTranslationEnabled(state);
}

/**
 * Reads a caption stored for the closed captions tab aloud, translating it first when the caption UI would.
 *
 * @param {IStore} store - The redux store.
 * @param {ISubtitle} subtitle - The stored caption.
 * @returns {void}
 */
function _maybeSpeakSubtitle(store: IStore, subtitle?: ISubtitle) {
    if (!subtitle || subtitle.interim || !subtitle.text?.trim() || !_shouldSpeak(store)) {
        return;
    }

    if (!_claimMessage(subtitle.id)) {
        return;
    }

    const state = store.getState();
    const { jwt } = state['features/base/jwt'];
    const { translateTo, voiceLanguage } = resolveSpokenLanguage(subtitle, state['features/subtitles']._language);
    const speechQueue = _getQueue(store);

    speechQueue.setEnabled(true);

    // Covers joining a meeting whose captions are already running, where none of the actions which normally settle this
    // are dispatched.
    _syncRemoteAudio(store);

    if (!translateTo) {
        speechQueue.enqueue({
            id: subtitle.id,
            language: voiceLanguage,
            text: subtitle.text
        });

        return;
    }

    translateLiveCaptionTextCached(subtitle.id, subtitle.text, translateTo, jwt)
        .then(text => {
            if (_shouldSpeak(store)) {
                speechQueue.enqueue({
                    id: subtitle.id,
                    language: voiceLanguage,
                    text
                });
            }
        })
        .catch(error => {
            logger.warn('Failed to translate a caption before speaking it', error);
        });
}

/**
 * Reads a caption rendered over the stage aloud. Those are already translated by the transcriber, so they are spoken in
 * the caption language the local user picked.
 *
 * @param {IStore} store - The redux store.
 * @param {string} messageId - The ID of the caption.
 * @param {string} text - The final caption text, if this update carries one.
 * @returns {void}
 */
function _maybeSpeakStageCaption(store: IStore, messageId: string, text?: string) {
    if (!text?.trim() || !_shouldSpeak(store)) {
        return;
    }

    if (!_claimMessage(messageId)) {
        return;
    }

    const speechQueue = _getQueue(store);

    speechQueue.setEnabled(true);
    _syncRemoteAudio(store);
    speechQueue.enqueue({
        id: messageId,
        language: toTtsLanguageTag(store.getState()['features/subtitles']._language),
        text
    });
}
