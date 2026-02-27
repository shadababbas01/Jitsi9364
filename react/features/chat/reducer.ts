import { UPDATE_CONFERENCE_METADATA } from '../base/conference/actionTypes';
import { ILocalParticipant, IParticipant } from '../base/participants/types';
import ReducerRegistry from '../base/redux/ReducerRegistry';
import { ADD_FILE, _FILE_LIST_RECEIVED } from '../file-sharing/actionTypes';
import { IVisitorChatParticipant } from '../visitors/types';

import {
    ADD_MESSAGE,
    ADD_MESSAGE_REACTION,
    CLEAR_MESSAGES,
    CLOSE_CHAT,
    DISMISS_TRANSCRIPTION_CONSENT,
    EDIT_MESSAGE,
    NOTIFY_PRIVATE_RECIPIENTS_CHANGED,
    OPEN_CHAT,
    REMOVE_LOBBY_CHAT_PARTICIPANT,
    RESET_TRANSCRIPTION_CONSENT,
    SET_CHAT_TAB_VISIBLE,
    SET_IS_POLL_TAB_FOCUSED,
    SET_LOBBY_CHAT_ACTIVE_STATE,
    SET_LOBBY_CHAT_RECIPIENT,
    SET_PRIVATE_MESSAGE_RECIPIENT,
    SET_TRANSCRIPTION_STARTED_BY_CURRENT_USER,
    SHOW_TRANSCRIPTION_CONSENT
} from './actionTypes';
import { CHAT_SIZE, ChatTabs } from './constants';
import { IMessage } from './types';

const DEFAULT_STATE = {
    groupChatWithPermissions: false,
    isOpen: false,
    isPollsTabFocused: false,
    isChatTabVisible: true,
    lastReadMessage: undefined,
    messages: [],
    notifyPrivateRecipientsChangedTimestamp: undefined,
    reactions: {},
    nbUnreadMessages: 0,
    nbUnreadFiles: 0,
    privateMessageRecipient: undefined,
    lobbyMessageRecipient: undefined,
    isLobbyChatActive: false,
    showTranscriptionConsent: false,
    transcriptionStartedByCurrentUser: false,
    transcriptionModeratorName: null,
    transcriptionStarterId: null,
    consentDismissedForSession: false
};

export interface IChatState {
    focusedTab: ChatTabs;
    groupChatWithPermissions: boolean;
    isLobbyChatActive: boolean;
    isOpen: boolean;
    isPollsTabFocused: boolean;
    isChatTabVisible: boolean;
    lastReadMessage?: IMessage;
    lobbyMessageRecipient?: {
        id: string;
        name: string;
    } | ILocalParticipant;
    messages: IMessage[];
    nbUnreadFiles: number;
    nbUnreadMessages: number;
    privateMessageRecipient?: IParticipant;
    showTranscriptionConsent: boolean;
    transcriptionStartedByCurrentUser: boolean;
    transcriptionModeratorName?: string | null;
    transcriptionStarterId?: string | null;
    consentDismissedForSession: boolean;
}

ReducerRegistry.register<IChatState>('features/chat', (state = DEFAULT_STATE, action): IChatState => {
    switch (action.type) {
        case ADD_MESSAGE: {
            const newMessage: IMessage = {
                displayName: action.displayName,
                error: action.error,
                id: action.id,
                isReaction: action.isReaction,
                messageId: uuidv4(),
                messageType: action.messageType,
                message: action.message,
                privateMessage: action.privateMessage,
                lobbyChat: action.lobbyChat,
                recipient: action.recipient,
                timestamp: action.timestamp
            };

            // React native, unlike web, needs a reverse sorted message list.
            const messages = navigator.product === 'ReactNative'
                ? [
                    newMessage,
                    ...state.messages
                ]
                : [
                    ...state.messages,
                    newMessage
                ];

            return {
                ...state,
                lastReadMessage:
                    action.hasRead ? newMessage : state.lastReadMessage,
                nbUnreadMessages: state.isPollsTabFocused ? state.nbUnreadMessages + 1 : state.nbUnreadMessages,
                messages
            };
        }

        case CLEAR_MESSAGES:
            return {
                ...state,
                lastReadMessage: undefined,
                messages: []
            };

        case EDIT_MESSAGE: {
            let found = false;
            const newMessage = action.message;
            const messages = state.messages.map(m => {
                if (m.messageId === newMessage.messageId) {
                    found = true;

                    return newMessage;
                }

                return m;
            });

            // no change
            if (!found) {
                return state;
            }

            return {
                ...state,
                messages
            };
        }

        case SET_PRIVATE_MESSAGE_RECIPIENT:
            return {
                ...state,
                privateMessageRecipient: action.participant
            };

        case OPEN_CHAT:
            return {
                ...state,
                isPollsTabFocused: false,
                isChatTabVisible: true,
                isOpen: true,
                privateMessageRecipient: action.participant
            };

        case CLOSE_CHAT:
            return {
                ...state,
                isOpen: false,
                lastReadMessage: state.messages[
                    navigator.product === 'ReactNative' ? 0 : state.messages.length - 1],
                privateMessageRecipient: action.participant,
                isLobbyChatActive: false
            };

        case SET_IS_POLL_TAB_FOCUSED: {
            return {
                ...state,
                isPollsTabFocused: action.isPollsTabFocused,
                nbUnreadMessages: 0
            };
        }


        case SET_CHAT_TAB_VISIBLE:
            return {
                ...state,
                isChatTabVisible: action.isVisible
            };

        case SET_LOBBY_CHAT_RECIPIENT:
            return {
                ...state,
                isLobbyChatActive: true,
                lobbyMessageRecipient: action.participant,
                privateMessageRecipient: undefined,
                isOpen: action.open
            };
        case SET_LOBBY_CHAT_ACTIVE_STATE:
            return {
                ...state,
                isLobbyChatActive: action.payload,
                isOpen: action.payload || state.isOpen,
                privateMessageRecipient: undefined
            };
        case REMOVE_LOBBY_CHAT_PARTICIPANT:
            return {
                ...state,
                messages: state.messages.filter(m => {
                    if (action.removeLobbyChatMessages) {
                        return !m.lobbyChat;
                    }

                    return true;
                }),
                isOpen: state.isOpen && state.isLobbyChatActive ? false : state.isOpen,
                isLobbyChatActive: false,
                lobbyMessageRecipient: undefined
            };
             case SHOW_TRANSCRIPTION_CONSENT:
        return {
            ...state,
            showTranscriptionConsent: true,
            transcriptionModeratorName: action.moderatorName,
            transcriptionStarterId: action.transcriptionStarterId,
            consentDismissedForSession: false
        };
    case DISMISS_TRANSCRIPTION_CONSENT:
        return {
            ...state,
            showTranscriptionConsent: false,
            transcriptionModeratorName: null,
            transcriptionStarterId: null,
            transcriptionStartedByCurrentUser: false,
            consentDismissedForSession: true
        };
    case SET_TRANSCRIPTION_STARTED_BY_CURRENT_USER:
        return {
            ...state,
            transcriptionStartedByCurrentUser: action.startedByCurrentUser
        };
    case RESET_TRANSCRIPTION_CONSENT:
        return {
            ...state,
            consentDismissedForSession: false
        };
    case SET_REQUESTING_SUBTITLES:
        if (!action.enabled) {
            return {
                ...state,
                showTranscriptionConsent: false,
                transcriptionModeratorName: null,
                transcriptionStarterId: null,
                transcriptionStartedByCurrentUser: false
            };
        }
        return state;
    }

    return state;
});
