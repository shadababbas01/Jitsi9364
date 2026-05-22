import { PARTICIPANT_LEFT } from '../base/participants/actionTypes';
import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    DISABLE_VOICE_TRANSLATION,
    ENABLE_VOICE_TRANSLATION,
    SET_ALLOWED_PARTICIPANT_ID,
    SET_PARTICIPANT_TRANSLATING,
    SET_PARTICIPANT_TRANSLATION_PREFERENCES,
    SET_TRANSLATION_PREFERENCES,
    SET_VOICE_TRANSLATION_POPUP_VISIBLE
} from './actionTypes';

/**
 * The Redux state for voice translation.
 */
export interface IVoiceTranslationState {
    allowedParticipantId: string | null;
    enabled: boolean;
    participantPreferences: {
        [participantId: string]: ITranslationPreferences;
    };
    preferences: ITranslationPreferences;
    showPreferencesPopup: boolean;
    startedBy?: string | null;
    translatingParticipants: {
        [participantId: string]: boolean;
    };
}

export interface ITranslationPreferences {
    dontTranslate: boolean;
    fromLanguage: string;
    toLanguage: string;
}

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
    translatingParticipants: {}
};

ReducerRegistry.register<IVoiceTranslationState>(
    'features/voice-translation',
    (state = DEFAULT_STATE, action): IVoiceTranslationState => {
        switch (action.type) {
        case ENABLE_VOICE_TRANSLATION:
            return {
                ...state,
                enabled: true,
                startedBy: action.startedBy ?? state.startedBy
            };

        case DISABLE_VOICE_TRANSLATION:
            return {
                ...state,
                allowedParticipantId: null,
                enabled: false,
                participantPreferences: {},
                showPreferencesPopup: false,
                startedBy: null,
                translatingParticipants: {}
            };

        case SET_TRANSLATION_PREFERENCES: {
            const { preferences, participantId } = action;
            const nextParticipantPreferences = participantId
                ? {
                    ...state.participantPreferences,
                    [participantId]: preferences
                }
                : state.participantPreferences;

            return {
                ...state,
                participantPreferences: nextParticipantPreferences,
                preferences
            };
        }

        case SET_PARTICIPANT_TRANSLATION_PREFERENCES:
            return {
                ...state,
                participantPreferences: {
                    ...state.participantPreferences,
                    [action.participantId]: action.preferences
                }
            };

        case SET_PARTICIPANT_TRANSLATING:
            return {
                ...state,
                translatingParticipants: {
                    ...state.translatingParticipants,
                    [action.participantId]: Boolean(action.translating)
                }
            };

        case SET_VOICE_TRANSLATION_POPUP_VISIBLE:
            return {
                ...state,
                showPreferencesPopup: action.visible
            };

        case SET_ALLOWED_PARTICIPANT_ID:
            return {
                ...state,
                allowedParticipantId: action.participantId
            };

        case PARTICIPANT_LEFT: {
            const participantId = action.participant?.id;

            if (!participantId) {
                return state;
            }

            const participantPreferences = { ...state.participantPreferences };
            const translatingParticipants = { ...state.translatingParticipants };

            delete participantPreferences[participantId];
            delete translatingParticipants[participantId];

            return {
                ...state,
                participantPreferences,
                translatingParticipants
            };
        }
        }

        return state;
    }
);
