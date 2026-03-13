import {
    CHANGE_VOTE,
    CLEAR_POLLS,
    EDIT_POLL,
    RECEIVE_ANSWER,
    RECEIVE_POLL,
    REGISTER_VOTE,
    REMOVE_POLL,
    RESET_NB_UNREAD_POLLS,
    RESET_UNREAD_POLLS_COUNT,
    RETRACT_VOTE,
    SAVE_POLL
} from './actionTypes';
import { IAnswer, IPoll, IPollData } from './types';

/**
 * Action to signal that existing polls needs to be cleared from state.
 *
 * @returns {{
 *     type: CLEAR_POLLS
 * }}
 */
export const clearPolls = () => {
    return { type: CLEAR_POLLS };
};

/**
 * Action to signal that a poll's vote will be changed.
 *
 * @param {string} pollId - The id of the incoming poll.
 * @param {boolean} value - The value of the 'changing' state.

 * @returns {{
 *     type: CHANGE_VOTE,
 *     pollId: string,
 *     value: boolean
 * }}
 */
export const setVoteChanging = (pollId: string, value: boolean) => {
    return {
        type: CHANGE_VOTE,
        pollId,
        value
    };
};

/**
 * Action to signal that a new poll was received.
 *
 * @param {string} pollId - The id of the incoming poll.
 * @param {IPoll} poll - The incoming Poll object.
 * @param {boolean} notify - Whether to send or not a notification.
 * @returns {{
 *     type: RECEIVE_POLL,
 *     poll: IPoll,
 *     pollId: string,
 *     notify: boolean
 * }}
 */
export const receivePoll = (pollId: string, poll: IPoll, notify: boolean) => {
    return {
        type: RECEIVE_POLL,
        poll,
        pollId,
        notify
    };
};

/**
 * Action to signal that a new answer was received.
 *
 * @param {string} pollId - The id of the incoming poll.
 * @param {IAnswer} answer - The incoming Answer object.
 * @returns {{
 *     type: RECEIVE_ANSWER,
 *     answer: IAnswer,
 *     pollId: string
 * }}
 */
export const receiveAnswer = (pollId: string, answer: IAnswer) => {
    return {
        type: RECEIVE_ANSWER,
        answer,
        pollId
    };
};

/**
 * Action to register a vote on a poll.
 *
 * @param {string} pollId - The id of the poll.
 * @param {?Array<boolean>} answers - The new answers.
 * @returns {{
 *     type: REGISTER_VOTE,
 *     answers: ?Array<boolean>,
 *     pollId: string
 * }}
 */
export const registerVote = (pollId: string, answers: Array<boolean> | null) => {
    return {
        type: REGISTER_VOTE,
        answers,
        pollId
    };
};

/**
 * Action to retract a vote on a poll.
 *
 * @param {string} pollId - The id of the poll.
 * @returns {{
 *     type: RETRACT_VOTE,
 *     pollId: string
 * }}
 */
export const retractVote = (pollId: string) => {
    return {
        type: RETRACT_VOTE,
        pollId
    };
};

/**
 * Action to signal the closing of the polls tab.
 *
 * @returns {{
 *     type: POLL_TAB_CLOSED
 * }}
 */
export function resetNbUnreadPollsMessages() {
    return {
        type: RESET_NB_UNREAD_POLLS
    };
}

/**
 * Action to signal the closing of the polls tab (alias).
 *
 * @returns {{
 *     type: RESET_UNREAD_POLLS_COUNT
 * }}
 */
export function resetUnreadPollsCount() {
    return {
        type: RESET_UNREAD_POLLS_COUNT
    };
}

/**
 * Action to signal saving a poll.
 *
 * @param {IPollData} poll - The Poll object that gets to be saved.
 * @returns {{
 *     type: SAVE_POLL,
 *     poll: IPollData,
 *     pollId: string
 * }}
 */
export function savePoll(poll: IPollData) {
    return {
        type: SAVE_POLL,
        poll,
        pollId: poll?.pollId ?? poll?.id
    };
}

/**
 * Action to signal editing a poll.
 *
 * @param {string} pollId - The id of the poll that gets to be edited.
 * @param {boolean} editing - Whether the poll is in edit mode or not.
 * @returns {{
 *     type: EDIT_POLL,
 *     pollId: string,
 *     editing: boolean
 * }}
 */
export function editPoll(pollId: string, editing: boolean) {
    return {
        type: EDIT_POLL,
        pollId,
        editing
    };
}

/**
 * Action to signal removing a poll.
 *
 * @param {IPoll} poll - The poll to be removed.
 * @param {string} pollId - The poll id.
 * @returns {{
 *     type: REMOVE_POLL,
 *     poll: IPoll,
 *     pollId: string
 * }}
 */
export function removePoll(poll: IPoll, pollId?: string) {
    return {
        type: REMOVE_POLL,
        poll,
        pollId: pollId ?? (poll as IPollData)?.pollId ?? (poll as IPollData)?.id
    };
}
