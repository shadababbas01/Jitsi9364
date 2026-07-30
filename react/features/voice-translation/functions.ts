import { IReduxState } from '../app/types';
import {
    getParticipantCount,
    getRemoteParticipants,
    isScreenShareParticipant
} from '../base/participants/functions';
import { IParticipant } from '../base/participants/types';

import { MAX_VOICE_TRANSLATION_PARTICIPANTS } from './constants';
import { ITranslationPreferences, IVoiceTranslationState } from './reducer';

const DEFAULT_PREFERENCES: ITranslationPreferences = {
    dontTranslate: false,
    fromLanguage: '',
    toLanguage: ''
};

const DEFAULT_STATE: IVoiceTranslationState = {
    allowedParticipantId: null,
    enabled: false,
    participantPreferences: {},
    preferences: DEFAULT_PREFERENCES,
    showPreferencesPopup: false,
    startedBy: null,
    translatingParticipants: {},
    ttsConnected: false
};

/**
 * Gets the voice translation state.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {IVoiceTranslationState}
 */
export function getVoiceTranslationState(state: IReduxState): IVoiceTranslationState {
    return state['features/voice-translation'] || DEFAULT_STATE;
}

/**
 * Checks if voice translation is enabled.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {boolean}
 */
export function isVoiceTranslationEnabled(state: IReduxState): boolean {
    return Boolean(getVoiceTranslationState(state).enabled);
}

/**
 * Checks if voice translation can be started in the current meeting.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {boolean}
 */
export function isVoiceTranslationAvailable(state: IReduxState): boolean {
    return getParticipantCount(state) === MAX_VOICE_TRANSLATION_PARTICIPANTS;
}

/**
 * Gets the local user's translation preferences.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {ITranslationPreferences}
 */
export function getLocalTranslationPreferences(state: IReduxState): ITranslationPreferences {
    return getVoiceTranslationState(state).preferences || DEFAULT_PREFERENCES;
}

/**
 * Gets a participant's translation preferences.
 *
 * @param {IReduxState} state - Redux state.
 * @param {string} participantId - Participant ID.
 * @returns {ITranslationPreferences | null}
 */
export function getParticipantTranslationPreferences(
        state: IReduxState, participantId: string): ITranslationPreferences | null {
    const { participantPreferences } = getVoiceTranslationState(state);

    return participantPreferences[participantId] || null;
}

/**
 * Checks if voice translation exceeds the participant limit.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {boolean}
 */
export function isVoiceTranslationLimitExceeded(state: IReduxState): boolean {
    return getParticipantCount(state) > MAX_VOICE_TRANSLATION_PARTICIPANTS;
}

/**
 * Gets the one-to-one remote participant for voice translation.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {IParticipant | undefined}
 */
export function getVoiceTranslationPeerParticipant(state: IReduxState): IParticipant | undefined {
    return Array.from(getRemoteParticipants(state).values())
        .find(participant => !isScreenShareParticipant(participant) && !participant.fakeParticipant);
}

/**
 * Determines if the local user should receive translation for a participant.
 *
 * @param {IReduxState} state - Redux state.
 * @param {string} participantId - Participant ID.
 * @returns {Object}
 */
export function getTranslationDecisionForParticipant(state: IReduxState, participantId: string): {
    shouldTranslate: boolean;
    sourceLanguage?: string;
    targetLanguage?: string;
} {
    const { enabled } = getVoiceTranslationState(state);
    const localPreferences = getLocalTranslationPreferences(state);
    const participantPreferences = getParticipantTranslationPreferences(state, participantId);

    if (!enabled || localPreferences.dontTranslate || !localPreferences.toLanguage) {
        return { shouldTranslate: false };
    }

    if (!participantPreferences?.fromLanguage) {
        return { shouldTranslate: false };
    }

    if (participantPreferences.fromLanguage === localPreferences.toLanguage) {
        return { shouldTranslate: false };
    }

    return {
        shouldTranslate: true,
        sourceLanguage: participantPreferences.fromLanguage,
        targetLanguage: localPreferences.toLanguage
    };
}

/**
 * Returns whether the local user should hear the translated voices instead of the original ones.
 *
 * The original voices are only replaced once translated audio can actually be delivered: while the service is
 * unreachable, or while the local user asked not to be translated, muting the others would leave them with silence.
 *
 * @param {IReduxState} state - Redux state.
 * @returns {boolean}
 */
export function shouldReplaceRemoteVoices(state: IReduxState): boolean {
    const { enabled, ttsConnected } = getVoiceTranslationState(state);
    const { dontTranslate, toLanguage } = getLocalTranslationPreferences(state);

    return Boolean(enabled && ttsConnected && !dontTranslate && toLanguage);
}
