import ReducerRegistry from '../base/redux/ReducerRegistry';
import { TRANSCRIBER_LEFT } from '../transcribing/actionTypes';
import { formatTranscriptMessage, ITranscriptHistoryMessage } from './helpers';

import {
    REMOVE_CACHED_TRANSCRIPT_MESSAGE,
    REMOVE_TRANSCRIPT_MESSAGE,
    SET_REQUESTING_SUBTITLES,
    SET_SUBTITLES_ERROR,
    STORE_SUBTITLE,
    TOGGLE_REQUESTING_SUBTITLES,
    UPDATE_TRANSCRIPT_MESSAGE,
    SET_SUMMARY_ENABLED,
    SET_SUMMARY_CATEGORY,
    SET_INTERVIEW_CONSENT
} from './actionTypes';
import { ISubtitle, ITranscriptMessage } from './types';
const MAX_HISTORY_ENTRIES = 200;


/**
 * Default State for 'features/transcription' feature.
 */
const defaultState = {
    _cachedTranscriptMessages: new Map(),
    _displaySubtitles: false,
    _transcriptMessages: new Map(),
    _requestingSubtitles: false,
    _language: null,
    messages: [],
    subtitlesHistory: [],
    _hasError: false,
    _history: [] as ITranscriptHistoryMessage[],
    _summaryEnabled: false,
    _summaryCategory: null as string | null,
    _interviewConsent: null as boolean | null,
    _summaryStateSynced: false
};

export interface ISubtitlesState {
    _cachedTranscriptMessages: Map<string, ITranscriptMessage>;
    _displaySubtitles: boolean;
    _hasError: boolean;
    _language: string | null;
    _requestingSubtitles: boolean;
    _transcriptMessages: Map<string, ITranscriptMessage> | any;
    _history: ITranscriptHistoryMessage[];
    _summaryEnabled: boolean;
    _summaryCategory: string | null;
    _interviewConsent: boolean | null;
    _summaryStateSynced: boolean;
}

/**
 * Listen for actions for the transcription feature to be used by the actions
 * to update the rendered transcription subtitles.
 */
ReducerRegistry.register<ISubtitlesState>('features/subtitles', (
        state = defaultState, action): ISubtitlesState => {
    switch (action.type) {
    case REMOVE_TRANSCRIPT_MESSAGE:
        return _removeTranscriptMessage(state, action);
    case REMOVE_CACHED_TRANSCRIPT_MESSAGE:
        return _removeCachedTranscriptMessage(state, action);
    case UPDATE_TRANSCRIPT_MESSAGE:
        return _updateTranscriptMessage(state, action);
    case SET_REQUESTING_SUBTITLES:
        return {
            ...state,
            _displaySubtitles: action.displaySubtitles,
            _language: action.language,
            _requestingSubtitles: action.enabled,
            _hasError: false
        };
    case TOGGLE_REQUESTING_SUBTITLES:
        return {
            ...state,
            _requestingSubtitles: !state._requestingSubtitles,
            _hasError: false
        };
    case TRANSCRIBER_LEFT:
        return {
            ...state,
            ...defaultState
        };
    case STORE_SUBTITLE: {
        const existingIndex = state.subtitlesHistory.findIndex(
            subtitle => subtitle.id === action.subtitle.id
        );

        if (existingIndex >= 0 && state.subtitlesHistory[existingIndex].interim) {
            const newHistory = [ ...state.subtitlesHistory ];

            newHistory[existingIndex] = action.subtitle;

            return {
                ...state,
                subtitlesHistory: newHistory
            };
        }

        return {
            ...state,
            subtitlesHistory: [
                ...state.subtitlesHistory,
                action.subtitle
            ]
        };
    }
    case SET_SUBTITLES_ERROR:
        return {
            ...state,
            _hasError: action.hasError
        };

    case TRANSCRIBER_LEFT: {
        const {
            _summaryEnabled,
            _summaryCategory,
            _interviewConsent,
            _summaryStateSynced
        } = state;
        return {
            ...state,
            ...defaultState,
            _summaryEnabled,
            _summaryCategory,
            _interviewConsent,
            _summaryStateSynced
        };
    }
    case SET_SUMMARY_ENABLED:
        return {
            ...state,
            _summaryEnabled: Boolean(action.enabled),
            _summaryStateSynced: true
        };
    case SET_SUMMARY_CATEGORY:
        return {
            ...state,
            _summaryCategory: action.category,
            _summaryStateSynced: true
        };
    case SET_INTERVIEW_CONSENT:
        return {
            ...state,
            _interviewConsent: Boolean(action.accepted)
        };
    }

    return state;
});

/**
 * Reduces a specific Redux action REMOVE_TRANSCRIPT_MESSAGE of the feature
 * transcription.
 *
 * @param {Object} state - The Redux state of the feature transcription.
 * @param {Action} action -The Redux action REMOVE_TRANSCRIPT_MESSAGE to reduce.
 * @returns {Object} The new state of the feature transcription after the
 * reduction of the specified action.
 */
function _removeTranscriptMessage(state: ISubtitlesState, { transcriptMessageID }: { transcriptMessageID: string; }) {
    const newTranscriptMessages = new Map(state._transcriptMessages);
    const message = newTranscriptMessages.get(transcriptMessageID);
    let { _cachedTranscriptMessages } = state;

    if (message && !message.final) {
        _cachedTranscriptMessages = new Map(_cachedTranscriptMessages);
        _cachedTranscriptMessages.set(transcriptMessageID, message);
    }

    // Deletes the key from Map once a final message arrives.
    newTranscriptMessages.delete(transcriptMessageID);

    return {
        ...state,
        _cachedTranscriptMessages,
        _transcriptMessages: newTranscriptMessages
    };
}


/**
 * Reduces a specific Redux action REMOVE_CACHED_TRANSCRIPT_MESSAGE of the feature transcription.
 *
 * @param {Object} state - The Redux state of the feature transcription.
 * @param {Action} action -The Redux action REMOVE_CACHED_TRANSCRIPT_MESSAGE to reduce.
 * @returns {Object} The new state of the feature transcription after the reduction of the specified action.
 */
function _removeCachedTranscriptMessage(state: ISubtitlesState,
        { transcriptMessageID }: { transcriptMessageID: string; }) {
    const newCachedTranscriptMessages = new Map(state._cachedTranscriptMessages);

    // Deletes the key from Map once a final message arrives.
    newCachedTranscriptMessages.delete(transcriptMessageID);

    return {
        ...state,
        _cachedTranscriptMessages: newCachedTranscriptMessages
    };
}

/**
 * Reduces a specific Redux action UPDATE_TRANSCRIPT_MESSAGE of the feature
 * transcription.
 *
 * @param {Object} state - The Redux state of the feature transcription.
 * @param {Action} action -The Redux action UPDATE_TRANSCRIPT_MESSAGE to reduce.
 * @returns {Object} The new state of the feature transcription after the
 * reduction of the specified action.
 */
function _updateTranscriptMessage(state: ISubtitlesState, { transcriptMessageID, newTranscriptMessage }:
{ newTranscriptMessage: ITranscriptMessage; transcriptMessageID: string; }) {
    const newTranscriptMessages = new Map(state._transcriptMessages);
    const _cachedTranscriptMessages = new Map(state._cachedTranscriptMessages);

    _cachedTranscriptMessages.delete(transcriptMessageID);

    // Updates the new message for the given key in the Map.
    newTranscriptMessages.set(transcriptMessageID, newTranscriptMessage);
     let history = state._history;
    const hasFinalText = Boolean(newTranscriptMessage?.final);

    if (hasFinalText) {
        const alreadyRecorded = history.some(entry => entry.id === transcriptMessageID);

        if (!alreadyRecorded) {
            const formattedText = formatTranscriptMessage(newTranscriptMessage);

            if (formattedText) {
                history = [
                    ...history,
                    {
                        id: transcriptMessageID,
                        language: newTranscriptMessage.language,
                        text: formattedText
                    }
                ];

                if (history.length > MAX_HISTORY_ENTRIES) {
                    history = history.slice(history.length - MAX_HISTORY_ENTRIES);
                }
            }
        }
    }

    return {
        ...state,
        _cachedTranscriptMessages,
        _transcriptMessages: newTranscriptMessages,
        _history: history
    };
}
