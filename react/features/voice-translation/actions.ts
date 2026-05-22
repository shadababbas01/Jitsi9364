import {
    DISABLE_VOICE_TRANSLATION,
    ENABLE_VOICE_TRANSLATION,
    SET_ALLOWED_PARTICIPANT_ID,
    SET_PARTICIPANT_TRANSLATING,
    SET_PARTICIPANT_TRANSLATION_PREFERENCES,
    SET_TRANSLATION_PREFERENCES,
    SET_VOICE_TRANSLATION_POPUP_VISIBLE
} from './actionTypes';
import { ITranslationPreferences } from './reducer';

/**
 * Enables voice translation.
 *
 * @param {Object} [options] - Optional metadata.
 * @returns {Object}
 */
export function enableVoiceTranslation(options?: {
    broadcast?: boolean;
    startedBy?: string;
    targetParticipantId?: string;
}) {
    return {
        type: ENABLE_VOICE_TRANSLATION,
        broadcast: options?.broadcast ?? true,
        startedBy: options?.startedBy,
        targetParticipantId: options?.targetParticipantId
    };
}

/**
 * Disables voice translation.
 *
 * @param {Object} [options] - Optional metadata.
 * @returns {Object}
 */
export function disableVoiceTranslation(options?: { broadcast?: boolean; reason?: string; }) {
    return {
        type: DISABLE_VOICE_TRANSLATION,
        broadcast: options?.broadcast ?? true,
        reason: options?.reason
    };
}

/**
 * Sets local translation preferences.
 *
 * @param {ITranslationPreferences} preferences - The local preferences.
 * @param {string} [participantId] - The local participant ID.
 * @returns {Object}
 */
export function setTranslationPreferences(preferences: ITranslationPreferences, participantId?: string) {
    return {
        type: SET_TRANSLATION_PREFERENCES,
        preferences,
        participantId
    };
}

/**
 * Updates a participant's translation preferences.
 *
 * @param {string} participantId - The participant ID.
 * @param {ITranslationPreferences} preferences - The participant preferences.
 * @returns {Object}
 */
export function setParticipantTranslationPreferences(participantId: string, preferences: ITranslationPreferences) {
    return {
        type: SET_PARTICIPANT_TRANSLATION_PREFERENCES,
        participantId,
        preferences
    };
}

/**
 * Marks a participant as actively translating.
 *
 * @param {string} participantId - The participant ID.
 * @param {boolean} translating - Whether the participant is being translated.
 * @param {Object} [options] - Optional metadata.
 * @returns {Object}
 */
export function setParticipantTranslating(
        participantId: string,
        translating: boolean,
        options?: { broadcast?: boolean; }) {
    return {
        type: SET_PARTICIPANT_TRANSLATING,
        participantId,
        translating,
        broadcast: options?.broadcast ?? true
    };
}

/**
 * Toggles the voice translation preferences popup/panel.
 *
 * @param {boolean} visible - Whether the popup/panel is visible.
 * @returns {Object}
 */
export function setVoiceTranslationPopupVisible(visible: boolean) {
    return {
        type: SET_VOICE_TRANSLATION_POPUP_VISIBLE,
        visible
    };
}

/**
 * Sets the participant that is allowed to receive voice translation.
 *
 * @param {string | null} participantId - The allowed participant ID.
 * @returns {Object}
 */
export function setAllowedParticipantId(participantId: string | null) {
    return {
        type: SET_ALLOWED_PARTICIPANT_ID,
        participantId
    };
}
