import ReducerRegistry from '../base/redux/ReducerRegistry';

import { SET_LIVE_TRANSCRIBE_ERROR, SET_LIVE_TRANSCRIBE_RUNNING } from './actionTypes';

export interface ILiveTranscribeState {

    /**
     * Why the transcription service could not be reached, if it could not be.
     */
    error: string | null;

    /**
     * Whether the local microphone is being captured and transcribed right now. False while muted, in the background
     * and outside a conference, even when the setting is on.
     */
    running: boolean;
}

const DEFAULT_STATE: ILiveTranscribeState = {
    error: null,
    running: false
};

ReducerRegistry.register<ILiveTranscribeState>('features/live-transcribe', (
        state = DEFAULT_STATE, action): ILiveTranscribeState => {
    switch (action.type) {
    case SET_LIVE_TRANSCRIBE_RUNNING:
        return {
            ...state,
            running: action.running
        };
    case SET_LIVE_TRANSCRIBE_ERROR:
        return {
            ...state,
            error: action.error
        };
    }

    return state;
});
