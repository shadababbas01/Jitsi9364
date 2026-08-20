import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    SET_CAPTION_TTS_SPEAKING,
    SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE,
    SET_CHAT_TTS_SPEAKER
} from './actionTypes';

export interface ICaptionTtsState {

    /**
     * The participant whose chat message is being read aloud, if any.
     */
    chatSpeakerId: string | null;

    /**
     * Whether a chat message is being read aloud right now, whoever sent it.
     */
    chatSpeaking: boolean;

    /**
     * The chat message being read aloud, so the UI can point at the one being spoken rather than at everything its
     * sender has said.
     */
    chatSpeakingMessageId: string | null;

    /**
     * Whether a caption is currently being read aloud.
     */
    speaking: boolean;

    /**
     * The ID of the caption being read aloud, so the UI can point at it.
     */
    speakingMessageId: string | null;

    /**
     * The caption language the device has no voice for, if any.
     */
    unsupportedLanguage: string | null;
}

const DEFAULT_STATE: ICaptionTtsState = {
    chatSpeakerId: null,
    chatSpeaking: false,
    chatSpeakingMessageId: null,
    speaking: false,
    speakingMessageId: null,
    unsupportedLanguage: null
};

ReducerRegistry.register<ICaptionTtsState>('features/caption-tts', (
        state = DEFAULT_STATE, action): ICaptionTtsState => {
    switch (action.type) {
    case SET_CAPTION_TTS_SPEAKING:
        return {
            ...state,
            speaking: action.speaking,
            speakingMessageId: action.speaking ? action.messageId ?? null : null
        };
    case SET_CHAT_TTS_SPEAKER:
        return {
            ...state,
            chatSpeakerId: action.participantId,
            chatSpeaking: Boolean(action.speaking),
            chatSpeakingMessageId: action.speaking ? action.messageId ?? null : null
        };
    case SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE:
        return {
            ...state,
            unsupportedLanguage: action.language
        };
    }

    return state;
});
