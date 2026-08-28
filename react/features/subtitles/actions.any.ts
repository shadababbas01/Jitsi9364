import { DEFAULT_LANGUAGE } from '../base/i18n/i18next';

import {
    REMOVE_CACHED_TRANSCRIPT_MESSAGE,
    REMOVE_TRANSCRIPT_MESSAGE,
    SET_CAPTIONS_STARTED_BY,
    SET_REQUESTING_SUBTITLES,
    SET_SUBTITLES_ERROR,
    SET_SUBTITLES_LANGUAGE,
    SET_SUBTITLES_PANEL_OPEN,
    STORE_SUBTITLE,
    TOGGLE_REQUESTING_SUBTITLES,
    UPDATE_TRANSCRIPT_MESSAGE
} from './actionTypes';
import { ISubtitle } from './types';

/**
 * What a caption state change carries beyond the state itself, when it did not originate with the local user.
 *
 * Live captions are a property of the room rather than of one device, so every transition is broadcast and every
 * receiver applies it. Both fields exist to make that safe: {@code fromRemoteSync} stops a receiver re-broadcasting
 * what it was just told, which would otherwise loop the room, and {@code startedBy} lets every device turn captions
 * off by itself when whoever started them leaves, without waiting to be told.
 */
export interface ICaptionsSyncOptions {
    fromRemoteSync?: boolean;
    startedBy?: string;
}

/**
 * Signals that a transcript has to be removed from the state.
 *
 * @param {string} transcriptMessageID - The message_id to be removed.
 * @returns {{
 *      type: REMOVE_TRANSCRIPT_MESSAGE,
 *      transcriptMessageID: string,
 * }}
 */
export function removeTranscriptMessage(transcriptMessageID: string) {
    return {
        type: REMOVE_TRANSCRIPT_MESSAGE,
        transcriptMessageID
    };
}

/**
 * Signals that a cached transcript has to be removed from the state.
 *
 * @param {string} transcriptMessageID - The message_id to be removed.
 * @returns {{
*      type: REMOVE_CACHED_TRANSCRIPT_MESSAGE,
*      transcriptMessageID: string,
* }}
*/
export function removeCachedTranscriptMessage(transcriptMessageID: string) {
    return {
        type: REMOVE_CACHED_TRANSCRIPT_MESSAGE,
        transcriptMessageID
    };
}

/**
 * Signals that a transcript with the given message_id to be added or updated
 * is received.
 *
 * @param {string} transcriptMessageID -The transcript message_id to be updated.
 * @param {Object} newTranscriptMessage - The updated transcript message.
 * @returns {{
 *      type: UPDATE_TRANSCRIPT_MESSAGE,
 *      transcriptMessageID: string,
 *      newTranscriptMessage: Object
 * }}
 */
export function updateTranscriptMessage(transcriptMessageID: string,
        newTranscriptMessage: Object) {
    return {
        type: UPDATE_TRANSCRIPT_MESSAGE,
        transcriptMessageID,
        newTranscriptMessage
    };
}

/**
 * Signals that the local user has toggled the ClosedCaption button.
 *
 * @param {ICaptionsSyncOptions} options - Where the toggle came from, when it did not come from this device's own user.
 * @returns {{
 *      type: TOGGLE_REQUESTING_SUBTITLES
 * }}
 */
export function toggleRequestingSubtitles(options: ICaptionsSyncOptions = {}) {
    return {
        type: TOGGLE_REQUESTING_SUBTITLES,
        fromRemoteSync: Boolean(options.fromRemoteSync),
        startedBy: options.startedBy
    };
}

/**
 * Signals that the local user has enabled or disabled the subtitles.
 *
 * @param {boolean} enabled - The new state of the subtitles.
 * @param {boolean} displaySubtitles - Whether to display subtitles or not.
 * @param {string} language - The language of the subtitles.
 * @param {boolean} forceBackendRecordingOn - Whether to force that backend recording is on.
 * @param {ICaptionsSyncOptions} options - Who turned the captions on, and whether this dispatch is the result of a
 * message from somebody else rather than of something the local user did. The latter is what stops a receiver
 * re-broadcasting what it has just been told.
 * @returns {{
 *    type: SET_REQUESTING_SUBTITLES,
 *    backendRecordingOn: boolean,
 *    enabled: boolean,
 *    displaySubtitles: boolean,
 *    language: string
 * }}
 */
export function setRequestingSubtitles(
        enabled: boolean,
        displaySubtitles = true,
        language: string | null = `translation-languages:${DEFAULT_LANGUAGE}`,
        forceBackendRecordingOn: boolean = false,
        options: ICaptionsSyncOptions = {}) {
    return {
        type: SET_REQUESTING_SUBTITLES,
        displaySubtitles,
        enabled,
        forceBackendRecordingOn,
        fromRemoteSync: Boolean(options.fromRemoteSync),
        language,
        startedBy: options.startedBy
    };
}

/**
 * Stores a received subtitle in the history.
 *
 * @param {ISubtitle} subtitle - The subtitle to store.
 * @returns {{
 *     type: STORE_SUBTITLE,
 *     subtitle: ISubtitle
 * }}
 */
export function storeSubtitle(subtitle: ISubtitle) {
    return {
        type: STORE_SUBTITLE,
        subtitle
    };
}

/**
 * Signals that an error occurred while starting subtitles.
 *
 * @param {boolean} hasError - Whether an error occurred or not.
 * @returns {{
 *    type: SET_SUBTITLES_ERROR,
 *    hasError: boolean
 * }}
 */
export function setSubtitlesError(hasError: boolean) {
    return {
        type: SET_SUBTITLES_ERROR,
        hasError
    };
}

/**
 * Sets the selected captions translation language.
 *
 * @param {string | null} language - The selected translation language.
 * @returns {Object}
 */
export function setSubtitlesLanguage(language: string | null) {
    return {
        type: SET_SUBTITLES_LANGUAGE,
        language
    };
}

/**
 * Shows or hides the live captions panel rendered next to the video.
 *
 * @param {boolean} open - Whether the panel should be visible.
 * @returns {Object}
 */
export function setSubtitlesPanelOpen(open: boolean) {
    return {
        type: SET_SUBTITLES_PANEL_OPEN,
        open
    };
}

/**
 * Records which participant turned live captions on.
 *
 * Dispatched on the starter's own device, which is the one place the answer is known for certain and the one place it
 * does not arrive in a message. Every other device learns it from the control message instead.
 *
 * @param {string} participantId - Who turned them on.
 * @returns {Object}
 */
export function setCaptionsStartedBy(participantId: string) {
    return {
        type: SET_CAPTIONS_STARTED_BY,
        participantId
    };
}
