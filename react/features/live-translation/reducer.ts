import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    SET_LIVE_TRANSLATION_ACTIVE,
    SET_LIVE_TRANSLATION_DICTATING,
    SET_LIVE_TRANSLATION_ERROR,
    SET_LIVE_TRANSLATION_MIC,
    SET_LIVE_TRANSLATION_PENDING
} from './actionTypes';

export interface ILiveTranslationState {

    /**
     * Whether the live translation call is running.
     */
    active: boolean;

    /**
     * Whether the recorder is hearing the local participant right now.
     */
    dictating: boolean;

    /**
     * The key of the message to show when something went wrong.
     */
    error: string | null;

    /**
     * Whether the microphone the call listens through is open.
     */
    micOn: boolean;

    /**
     * How many utterances are being transcribed and sent.
     */
    pending: number;
}

const DEFAULT_STATE: ILiveTranslationState = {
    active: false,
    dictating: false,
    error: null,
    micOn: true,
    pending: 0
};

ReducerRegistry.register<ILiveTranslationState>('features/live-translation', (
        state = DEFAULT_STATE, action): ILiveTranslationState => {
    switch (action.type) {
    case SET_LIVE_TRANSLATION_ACTIVE:
        return {
            ...state,
            active: action.active,

            // Leaving the call and coming back starts listening again, which is what turning it on means.
            micOn: action.active ? true : state.micOn,
            dictating: false,
            error: null,
            pending: 0
        };

    case SET_LIVE_TRANSLATION_MIC:
        return {
            ...state,
            micOn: action.micOn,
            dictating: action.micOn ? state.dictating : false
        };

    case SET_LIVE_TRANSLATION_DICTATING:
        return {
            ...state,
            dictating: action.dictating
        };

    case SET_LIVE_TRANSLATION_PENDING:
        return {
            ...state,
            pending: Math.max(0, action.pending)
        };

    case SET_LIVE_TRANSLATION_ERROR:
        return {
            ...state,
            error: action.error
        };
    }

    return state;
});
