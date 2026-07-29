import ReducerRegistry from '../base/redux/ReducerRegistry';

import { SET_CAPTION_TTS_SPEAKING, SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE } from './actionTypes';

export interface ICaptionTtsState {

    /**
     * Whether a caption is currently being read aloud.
     */
    speaking: boolean;

    /**
     * The caption language the device has no voice for, if any.
     */
    unsupportedLanguage: string | null;
}

const DEFAULT_STATE: ICaptionTtsState = {
    speaking: false,
    unsupportedLanguage: null
};

ReducerRegistry.register<ICaptionTtsState>('features/caption-tts', (
        state = DEFAULT_STATE, action): ICaptionTtsState => {
    switch (action.type) {
    case SET_CAPTION_TTS_SPEAKING:
        return {
            ...state,
            speaking: action.speaking
        };
    case SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE:
        return {
            ...state,
            unsupportedLanguage: action.language
        };
    }

    return state;
});
