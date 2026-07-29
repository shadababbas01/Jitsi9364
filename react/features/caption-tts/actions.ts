import { updateSettings } from '../base/settings/actions';

import { SET_CAPTION_TTS_SPEAKING, SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE } from './actionTypes';

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
 * @returns {Object}
 */
export function setCaptionTtsSpeaking(speaking: boolean) {
    return {
        type: SET_CAPTION_TTS_SPEAKING,
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
