import PersistenceRegistry from '../base/redux/PersistenceRegistry';
import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    ADD_S2S_V2_TRANSCRIPT,
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
    SET_S2S_V2_TRANSCRIPT_SPEAKING
} from './actionTypes';
import { S2SV2Theme } from './components/native/palettes';
import { DEFAULT_SOURCE_LANGUAGE } from './constants';

/**
 * One utterance, as it is shown.
 *
 * Held under its message ID rather than in a list so that the translation, which arrives after the words themselves,
 * appears underneath what was said instead of as a second entry of its own.
 */
export interface IS2SV2TranscriptEntry {

    /**
     * How the utterance identifies itself, and the key it is held under.
     */
    messageId: string;

    /**
     * What was said, in English.
     */
    originalText: string;

    /**
     * Who said it.
     */
    speakerId: string;

    /**
     * What to call them on screen.
     */
    speakerName: string;

    /**
     * When they said it, by their own clock.
     */
    timestamp: number;

    /**
     * What it came to in the local listener's language. Absent until the translation returns, and absent for good when
     * the listener is already listening in the language it was said in.
     */
    translatedText?: string;
}

export interface IS2SV2State {

    /**
     * Whether a translated session is running.
     */
    enabled: boolean;

    /**
     * Whether more than one person is talking at once. Worked out on this device rather than announced by anybody.
     */
    multipleSpeakersDetected: boolean;

    /**
     * How the running session identifies itself.
     */
    sessionId?: string;

    /**
     * Whether the language and suppression popup is on screen.
     */
    showLanguagePopup: boolean;

    /**
     * Whether the translation panel is on screen. Local: closing it does not end the session.
     */
    showPanel: boolean;

    /**
     * Whether the moderator is being asked to confirm stopping.
     */
    showStopConfirm: boolean;

    /**
     * Which language the speech service is told to expect, as the session announced it.
     */
    sourceLanguage: string;

    /**
     * Which moderator started it.
     */
    startedBy?: string;

    /**
     * Whether the original voices are turned down underneath the translation.
     *
     * A local preference which outlives the session and the app. Never sent to anybody: what one listener does with the
     * volume is no business of the meeting's.
     */
    suppressOriginalVoice: boolean;

    /**
     * Which of the two ways the panel is drawn.
     *
     * Local and persisted, like the two below. The meeting is dark; the panel is where a listener does their reading,
     * and reading is the one thing a dark screen is not always better for.
     */
    /**
     * Which language this device wants to hear everybody in.
     *
     * Local and persisted, for the same reason as the suppression. Translation happens on the receiving device, so ten
     * listeners in ten languages cost one message on the wire and ten local translations.
     */
    targetLanguage: string;

    /**
     * Which of the two ways the panel is drawn.
     *
     * Local and persisted, like the two above. The meeting is dark; the panel is where a listener does their reading,
     * and reading is the one thing a dark screen is not always better for.
     */
    theme: S2SV2Theme;

    /**
     * What has been said, keyed by message ID.
     */
    transcripts: { [messageId: string]: IS2SV2TranscriptEntry; };

    /**
     * Which utterances are still being translated, keyed by message ID and carrying the speaker ID they belong to.
     */
    translating: { [messageId: string]: string; };

    /**
     * Which transcript is currently being read aloud, if any.
     */
    speakingMessageId: string | null;
}

const STORE_NAME = 'features/s2s-v2';

const DEFAULT_STATE: IS2SV2State = {
    enabled: false,
    multipleSpeakersDetected: false,
    showLanguagePopup: false,
    showPanel: false,
    showStopConfirm: false,
    sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    suppressOriginalVoice: true,
    targetLanguage: '',
    theme: 'dark',
    transcripts: {},
    translating: {},
    speakingMessageId: null
};

/**
 * Only the two local preferences outlive the app. Everything else describes a session which is over by then.
 */
PersistenceRegistry.register(STORE_NAME, {
    suppressOriginalVoice: true,
    targetLanguage: true,
    theme: true
}, DEFAULT_STATE);

ReducerRegistry.register<IS2SV2State>(STORE_NAME, (state = DEFAULT_STATE, action): IS2SV2State => {
    switch (action.type) {
    case SET_S2S_V2_SESSION:
        return {
            ...state,
            enabled: true,
            sessionId: action.sessionId,
            sourceLanguage: action.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
            startedBy: action.startedBy
        };

    // What was said stays on screen: it is the conversation, not part of the session. The two preferences stay as well,
    // so that the next session does not ask again.
    case CLEAR_S2S_V2_SESSION:
        return {
            ...state,
            enabled: false,
            multipleSpeakersDetected: false,
            sessionId: undefined,
            showLanguagePopup: false,
            showPanel: false,
            showStopConfirm: false,
            sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
            startedBy: undefined,
            transcripts: {},
            translating: {},
            speakingMessageId: null
        };

    case SET_S2S_V2_TARGET_LANGUAGE:
        return {
            ...state,
            targetLanguage: action.targetLanguage
        };

    case SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE:
        return {
            ...state,
            suppressOriginalVoice: action.suppressOriginalVoice
        };

    case SET_S2S_V2_THEME:
        return {
            ...state,
            theme: action.theme
        };

    case SET_S2S_V2_LANGUAGE_POPUP:
        return {
            ...state,
            showLanguagePopup: action.visible
        };

    case SET_S2S_V2_PANEL:
        return {
            ...state,
            showPanel: action.visible
        };

    case SET_S2S_V2_STOP_CONFIRM:
        return {
            ...state,
            showStopConfirm: action.visible
        };

    case ADD_S2S_V2_TRANSCRIPT:
        return {
            ...state,
            transcripts: {
                ...state.transcripts,
                [action.messageId]: {
                    messageId: action.messageId,
                    originalText: action.originalText,
                    speakerId: action.speakerId,
                    speakerName: action.speakerName,
                    timestamp: action.timestamp,
                    translatedText: state.transcripts[action.messageId]?.translatedText
                }
            }
        };

    // The translation lands on the entry which is already there rather than beside it. An entry which has gone - the
    // history was cleared while the translation was in flight - is not brought back by it.
    case SET_S2S_V2_TRANSCRIPT_TRANSLATION: {
        const existing = state.transcripts[action.messageId];

        if (!existing) {
            return state;
        }

        return {
            ...state,
            transcripts: {
                ...state.transcripts,
                [action.messageId]: {
                    ...existing,
                    translatedText: action.translatedText
                }
            }
        };
    }

    case SET_S2S_V2_TRANSCRIPT_TRANSLATING: {
        const translating = { ...state.translating };

        if (action.translating) {
            translating[action.messageId] = action.speakerId;
        } else {
            delete translating[action.messageId];
        }

        return {
            ...state,
            translating
        };
    }

    case SET_S2S_V2_TRANSCRIPT_SPEAKING:
        return {
            ...state,
            speakingMessageId: action.messageId
        };

    case CLEAR_S2S_V2_TRANSCRIPTS:
        return {
            ...state,
            transcripts: {},
            translating: {},
            speakingMessageId: null
        };

    case SET_S2S_V2_MULTIPLE_SPEAKERS:
        return {
            ...state,
            multipleSpeakersDetected: action.detected
        };
    }

    return state;
});
