import { PARTICIPANT_LEFT } from '../base/participants/actionTypes';
import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    ADD_LIVE_TRANSLATION_UTTERANCE,
    SET_LIVE_TRANSLATION_ACTIVE,
    SET_LIVE_TRANSLATION_DICTATING,
    SET_LIVE_TRANSLATION_ERROR,
    SET_LIVE_TRANSLATION_MIC,
    SET_LIVE_TRANSLATION_PENDING,
    SET_LIVE_TRANSLATION_UNTRANSLATED,
    SET_LIVE_TRANSLATION_UTTERANCE_TRANSLATION
} from './actionTypes';
import { LIVE_TRANSLATION_UTTERANCE_LIMIT } from './constants';

export interface ILiveTranslationUtterance {

    /**
     * The ID of the message the utterance arrived in.
     */
    id: string;

    /**
     * The language the translation is read aloud in, once there is one.
     */
    language: string | null;

    /**
     * Who said it.
     */
    participantId: string;

    /**
     * What was said, in the language it was said in.
     */
    text: string;

    /**
     * When the message carrying it was sent.
     */
    timestamp: number;

    /**
     * The text the engine is given to speak. Null until the translation service has answered, which is what tells the
     * panel to show the utterance as still being worked on rather than as untranslated.
     */
    translation: string | null;
}

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

    /**
     * The participants the local user would rather hear in their own voice than have read out in translation, by ID.
     * Absent means translated, which is what a translated call is for.
     */
    untranslated: { [participantId: string]: boolean; };

    /**
     * What has been said in the call, oldest first, as received and as read aloud.
     */
    utterances: ILiveTranslationUtterance[];
}

const DEFAULT_STATE: ILiveTranslationState = {
    active: false,
    dictating: false,
    error: null,
    micOn: true,
    pending: 0,
    untranslated: {},
    utterances: []
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
            pending: 0,

            // A new call starts with nothing said in it. What was said in the last one has been heard and is over.
            utterances: []
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

    case SET_LIVE_TRANSLATION_UNTRANSLATED: {
        const untranslated = { ...state.untranslated };

        if (action.untranslated) {
            untranslated[action.participantId] = true;
        } else {
            delete untranslated[action.participantId];
        }

        return {
            ...state,
            untranslated
        };
    }

    case ADD_LIVE_TRANSLATION_UTTERANCE: {
        // Nothing is said twice: a message which is already in the list has arrived again, and re-adding it would put a
        // second copy of it on screen and lose the translation already attached to the first.
        if (state.utterances.some(utterance => utterance.id === action.id)) {
            return state;
        }

        const utterances = [
            ...state.utterances,
            {
                id: action.id,
                language: null,
                participantId: action.participantId,
                text: action.text,
                timestamp: action.timestamp,
                translation: null
            }
        ];

        return {
            ...state,

            // The oldest go, so a long meeting cannot grow the list without bounds.
            utterances: utterances.slice(-LIVE_TRANSLATION_UTTERANCE_LIMIT)
        };
    }

    case SET_LIVE_TRANSLATION_UTTERANCE_TRANSLATION: {
        if (!state.utterances.some(utterance => utterance.id === action.id)) {
            return state;
        }

        return {
            ...state,
            utterances: state.utterances.map(utterance => utterance.id === action.id
                ? {
                    ...utterance,
                    language: action.language,
                    translation: action.translation
                }
                : utterance)
        };
    }

    // Somebody who has left cannot be heard either way, and the next participant to be given their ID must not inherit
    // the choice made about them.
    case PARTICIPANT_LEFT: {
        const participantId = action.participant?.id;

        if (!participantId || !state.untranslated[participantId]) {
            return state;
        }

        const untranslated = { ...state.untranslated };

        delete untranslated[participantId];

        return {
            ...state,
            untranslated
        };
    }
    }

    return state;
});
