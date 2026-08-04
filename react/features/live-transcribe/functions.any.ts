import { IReduxState } from '../app/types';

import { ILiveTranscribeState } from './reducer';

const DEFAULT_STATE: ILiveTranscribeState = {
    error: null,
    running: false
};

/**
 * Returns the live transcription state.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {ILiveTranscribeState}
 */
export function getLiveTranscribeState(state: IReduxState): ILiveTranscribeState {
    return state['features/live-transcribe'] ?? DEFAULT_STATE;
}

/**
 * Returns whether the local user asked for their own speech to be transcribed into captions.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isLiveTranscribeEnabled(state: IReduxState): boolean {
    return Boolean(state['features/base/settings'].transcribeOwnSpeech);
}
