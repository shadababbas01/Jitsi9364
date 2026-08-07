import { updateSettings } from '../base/settings/actions';

import {
    SET_CAPTION_TTS_SPEAKING,
    SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE,
    SET_CHAT_TTS_SPEAKER
} from './actionTypes';

/**
 * Turns reading the live captions aloud on or off.
 *
 * @param {boolean} enabled - Whether captions should be read aloud.
 * @returns {Object}
 */
export function setCaptionTtsEnabled(enabled: boolean) {
    return updateSettings({ readCaptionsAloud: enabled });
}

/**
 * Indicates whether a caption is currently being read aloud.
 *
 * @param {boolean} speaking - Whether a caption is being spoken.
 * @param {string} messageId - The ID of the caption being spoken, if any.
 * @returns {Object}
 */
export function setCaptionTtsSpeaking(speaking: boolean, messageId?: string) {
    return {
        type: SET_CAPTION_TTS_SPEAKING,
        messageId,
        speaking
    };
}

/**
 * Records that the device has no voice for the given language, so the UI can say so.
 *
 * @param {string} language - The language which cannot be spoken, or null to clear the state.
 * @returns {Object}
 */
export function setCaptionTtsUnsupportedLanguage(language: string | null) {
    return {
        type: SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE,
        language
    };
}

/**
 * Records whose chat message is being read aloud, or that none is.
 *
 * @param {string | null} participantId - The participant whose message is being spoken, if known.
 * @param {boolean} speaking - Whether a message is being spoken at all. Tracked separately because a message whose
 * sender cannot be identified still has to stop the microphone from hearing it.
 * @returns {Object}
 */
export function setChatTtsSpeaker(participantId: string | null, speaking = Boolean(participantId)) {
    return {
        type: SET_CHAT_TTS_SPEAKER,
        participantId,
        speaking
    };
}
