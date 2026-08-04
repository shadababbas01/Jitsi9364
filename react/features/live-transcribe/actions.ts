import { updateSettings } from '../base/settings/actions';

import { SET_LIVE_TRANSCRIBE_ERROR, SET_LIVE_TRANSCRIBE_RUNNING } from './actionTypes';

/**
 * Turns transcribing the local participant's own speech on or off.
 *
 * @param {boolean} enabled - Whether the local microphone should be transcribed.
 * @returns {Object}
 */
export function setLiveTranscribeEnabled(enabled: boolean) {
    return updateSettings({ transcribeOwnSpeech: enabled });
}

/**
 * Indicates whether the local microphone is being captured and transcribed right now.
 *
 * @param {boolean} running - Whether capturing is running.
 * @returns {Object}
 */
export function setLiveTranscribeRunning(running: boolean) {
    return {
        type: SET_LIVE_TRANSCRIBE_RUNNING,
        running
    };
}

/**
 * Records that the transcription service could not be reached, or clears a previously recorded failure.
 *
 * @param {string} error - What went wrong, or null once it stopped going wrong.
 * @returns {Object}
 */
export function setLiveTranscribeError(error: string | null) {
    return {
        type: SET_LIVE_TRANSCRIBE_ERROR,
        error
    };
}
