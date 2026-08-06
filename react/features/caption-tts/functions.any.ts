import { IReduxState } from '../app/types';
import { getSubtitleTranslationTarget, normalizeSubtitlesLanguage } from '../subtitles/languages';
import { ISubtitle } from '../subtitles/types';

import { FALLBACK_LANGUAGE_TAG, LANGUAGE_TAG_OVERRIDES } from './constants';
import { ICaptionTtsState } from './reducer';

const DEFAULT_STATE: ICaptionTtsState = {
    chatSpeakerId: null,
    speaking: false,
    speakingMessageId: null,
    unsupportedLanguage: null
};

/**
 * Returns the caption text-to-speech state.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {ICaptionTtsState}
 */
export function getCaptionTtsState(state: IReduxState): ICaptionTtsState {
    return state['features/caption-tts'] ?? DEFAULT_STATE;
}

/**
 * Returns whether the local user asked for the live captions to be read aloud.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isCaptionTtsEnabled(state: IReduxState): boolean {
    return Boolean(state['features/base/settings'].readCaptionsAloud);
}

/**
 * Returns whether chat messages coming from other participants are read aloud as they arrive. On by default: the point
 * of the feature is that a message is heard without having to open the chat, so it has to be opted out of rather than
 * into.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isChatTtsEnabled(state: IReduxState): boolean {
    return state['features/base/settings'].readChatAloud !== false;
}

/**
 * Returns the participant whose chat message is being read aloud right now, if any.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string | null}
 */
export function getChatTtsSpeakerId(state: IReduxState): string | null {
    return getCaptionTtsState(state).chatSpeakerId;
}

/**
 * Turns a language code coming from the captions into a BCP-47 tag the device engine can look a voice up with.
 *
 * @param {string} language - A language code, with or without a region, e.g. 'hi', 'en-GB' or 'zh_TW'.
 * @returns {string}
 */
export function toTtsLanguageTag(language?: string | null): string {
    const code = normalizeSubtitlesLanguage(language)?.replace(/_/g, '-');

    if (!code) {
        return FALLBACK_LANGUAGE_TAG;
    }

    if (code.includes('-')) {
        return code;
    }

    return LANGUAGE_TAG_OVERRIDES[code.toLowerCase()] ?? code;
}

/**
 * Works out which language a subtitle will be spoken in. When the local user picked a caption language the caption is
 * translated into it before being displayed, so that is also the language it has to be spoken in. Otherwise the caption
 * is shown, and spoken, in the language it was transcribed in.
 *
 * @param {ISubtitle} subtitle - The received subtitle.
 * @param {string} selectedLanguage - The caption language the local user selected, if any.
 * @returns {Object} - The language to speak in and the language to translate the text into, if any.
 */
export function resolveSpokenLanguage(subtitle: ISubtitle, selectedLanguage?: string | null): {
    translateTo: string | null;
    voiceLanguage: string;
} {
    const translateTo = getSubtitleTranslationTarget(subtitle, selectedLanguage);

    return {
        translateTo,
        voiceLanguage: toTtsLanguageTag(translateTo ?? subtitle.language)
    };
}

/**
 * Returns the ID of the caption currently being read aloud, if any.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string | null}
 */
export function getSpeakingCaptionId(state: IReduxState): string | null {
    const { speaking, speakingMessageId } = getCaptionTtsState(state);

    return speaking ? speakingMessageId : null;
}
