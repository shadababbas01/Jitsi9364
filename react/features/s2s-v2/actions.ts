import {
    ADD_S2S_V2_TRANSCRIPT,
    BROADCAST_S2S_V2_TRANSCRIPT,
    CLEAR_S2S_V2_SESSION,
    CLEAR_S2S_V2_TRANSCRIPTS,
    SET_S2S_V2_LANGUAGE_POPUP,
    SET_S2S_V2_MULTIPLE_SPEAKERS,
    SET_S2S_V2_PANEL,
    SET_S2S_V2_SESSION,
    SET_S2S_V2_STOP_CONFIRM,
    SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE,
    SET_S2S_V2_TARGET_LANGUAGE,
    SET_S2S_V2_THEME,
    SET_S2S_V2_TRANSCRIPT_TRANSLATION,
    SET_S2S_V2_TRANSCRIPT_TRANSLATING,
    SET_S2S_V2_TRANSCRIPT_SPEAKING,
    START_S2S_V2_SESSION,
    STOP_S2S_V2_SESSION
} from './actionTypes';
import { S2SV2Theme } from './components/native/palettes';

/**
 * Asks for a translated session to begin. Acted on only by a moderator's device.
 *
 * @returns {Object}
 */
export function startS2SV2Session() {
    return { type: START_S2S_V2_SESSION };
}

/**
 * Asks for the running session to end for everybody. Acted on only by a moderator's device.
 *
 * @returns {Object}
 */
export function stopS2SV2Session() {
    return { type: STOP_S2S_V2_SESSION };
}

/**
 * Records that a session is running.
 *
 * @param {string} sessionId - How the session identifies itself.
 * @param {string} startedBy - The moderator who started it.
 * @param {string} sourceLanguage - Which language the speech service is told to expect.
 * @returns {Object}
 */
export function setS2SV2Session(sessionId: string, startedBy: string, sourceLanguage: string) {
    return {
        type: SET_S2S_V2_SESSION,
        sessionId,
        sourceLanguage,
        startedBy
    };
}

/**
 * Records that no session is running. Leaves the transcripts and the local preferences where they are.
 *
 * @returns {Object}
 */
export function clearS2SV2Session() {
    return { type: CLEAR_S2S_V2_SESSION };
}

/**
 * Records which language this device wants to hear everybody in. Never sent to anybody.
 *
 * @param {string} targetLanguage - The language.
 * @returns {Object}
 */
export function setS2SV2TargetLanguage(targetLanguage: string) {
    return {
        type: SET_S2S_V2_TARGET_LANGUAGE,
        targetLanguage
    };
}

/**
 * Records whether this device turns the original voices down underneath the translation. Never sent to anybody.
 *
 * @param {boolean} suppressOriginalVoice - Whether to turn them down.
 * @returns {Object}
 */
export function setS2SV2SuppressOriginalVoice(suppressOriginalVoice: boolean) {
    return {
        type: SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE,
        suppressOriginalVoice
    };
}

/**
 * Records which of the two ways the panel is drawn.
 *
 * @param {S2SV2Theme} theme - Dark, or light.
 * @returns {Object}
 */
export function setS2SV2Theme(theme: S2SV2Theme) {
    return {
        type: SET_S2S_V2_THEME,
        theme
    };
}

/**
 * Shows or hides the language and suppression popup.
 *
 * @param {boolean} visible - Whether it is on screen.
 * @returns {Object}
 */
export function setS2SV2LanguagePopupVisible(visible: boolean) {
    return {
        type: SET_S2S_V2_LANGUAGE_POPUP,
        visible
    };
}

/**
 * Shows or hides the translation panel on this device alone.
 *
 * @param {boolean} visible - Whether it is on screen.
 * @returns {Object}
 */
export function setS2SV2PanelVisible(visible: boolean) {
    return {
        type: SET_S2S_V2_PANEL,
        visible
    };
}

/**
 * Shows or hides the moderator's confirmation before stopping.
 *
 * @param {boolean} visible - Whether it is on screen.
 * @returns {Object}
 */
export function setS2SV2StopConfirmVisible(visible: boolean) {
    return {
        type: SET_S2S_V2_STOP_CONFIRM,
        visible
    };
}

/**
 * Records one utterance as it was said, in English.
 *
 * @param {string} messageId - How the utterance identifies itself.
 * @param {string} speakerId - Who said it.
 * @param {string} speakerName - What to call them on screen.
 * @param {string} originalText - What they said.
 * @param {number} timestamp - When, by the speaker's clock.
 * @returns {Object}
 */
export function addS2SV2Transcript(
        messageId: string,
        speakerId: string,
        speakerName: string,
        originalText: string,
        timestamp: number) {
    return {
        type: ADD_S2S_V2_TRANSCRIPT,
        messageId,
        originalText,
        speakerId,
        speakerName,
        timestamp
    };
}

/**
 * Records what one utterance came to in the local listener's language.
 *
 * @param {string} messageId - The utterance being translated.
 * @param {string} translatedText - What it came to.
 * @returns {Object}
 */
export function setS2SV2TranscriptTranslation(messageId: string, translatedText: string) {
    return {
        type: SET_S2S_V2_TRANSCRIPT_TRANSLATION,
        messageId,
        translatedText
    };
}

/**
 * Records whether one utterance is currently being translated.
 *
 * @param {string} messageId - The utterance being translated.
 * @param {string} speakerId - Who said it.
 * @param {boolean} translating - Whether it is still in flight.
 * @returns {Object}
 */
export function setS2SV2TranscriptTranslating(messageId: string, speakerId: string, translating: boolean) {
    return {
        type: SET_S2S_V2_TRANSCRIPT_TRANSLATING,
        messageId,
        speakerId,
        translating
    };
}

/**
 * Records which transcript is currently being read aloud.
 *
 * @param {string | null} messageId - The transcript being spoken, or null.
 * @returns {Object}
 */
export function setS2SV2TranscriptSpeaking(messageId: string | null) {
    return {
        type: SET_S2S_V2_TRANSCRIPT_SPEAKING,
        messageId
    };
}

/**
 * Empties this device's transcript history.
 *
 * @returns {Object}
 */
export function clearS2SV2Transcripts() {
    return { type: CLEAR_S2S_V2_TRANSCRIPTS };
}

/**
 * Records whether more than one person is talking at once.
 *
 * @param {boolean} detected - Whether they are.
 * @returns {Object}
 */
export function setS2SV2MultipleSpeakers(detected: boolean) {
    return {
        type: SET_S2S_V2_MULTIPLE_SPEAKERS,
        detected
    };
}

/**
 * Sends one finished utterance to the meeting, and shows it locally at the same moment.
 *
 * @param {string} originalText - The English transcript of what was said.
 * @returns {Object}
 */
export function broadcastS2SV2Transcript(originalText: string) {
    return {
        type: BROADCAST_S2S_V2_TRANSCRIPT,
        originalText
    };
}
