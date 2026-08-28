/**
 * The type of (redux) action which indicates that an existing transcript
 * has to be removed from the state.
 *
 * {
 *      type: REMOVE_TRANSCRIPT_MESSAGE,
 *      transciptMessageID: string,
 * }
 */
export const REMOVE_TRANSCRIPT_MESSAGE = 'REMOVE_TRANSCRIPT_MESSAGE';

/**
 * The type of (redux) action which indicates that an cached transcript
 * has to be removed from the state.
 *
 * {
 *      type: REMOVE_CACHED_TRANSCRIPT_MESSAGE,
 *      transciptMessageID: string,
 * }
 */
export const REMOVE_CACHED_TRANSCRIPT_MESSAGE = 'REMOVE_CACHED_TRANSCRIPT_MESSAGE';

/**
 * The type of (redux) action which indicates that a transcript with an
 * given message_id to be added or updated is received.
 *
 * {
 *      type: UPDATE_TRANSCRIPT_MESSAGE,
 *      transcriptMessageID: string,
 *      newTranscriptMessage: Object
 * }
 */
export const UPDATE_TRANSCRIPT_MESSAGE = 'UPDATE_TRANSCRIPT_MESSAGE';

/**
 * The type of (redux) action which indicates that the user pressed the
 * ClosedCaption button, to either enable or disable subtitles based on the
 * current state.
 *
 * {
 *      type: TOGGLE_REQUESTING_SUBTITLES
 * }
 */
export const TOGGLE_REQUESTING_SUBTITLES
    = 'TOGGLE_REQUESTING_SUBTITLES';

/**
 * The type of (redux) action which indicates if the user set the state of
 * the subtitles to enabled or disabled.
 *
 * {
 *      type: SET_REQUESTING_SUBTITLES
 *      enabled: boolean
 * }
 */
export const SET_REQUESTING_SUBTITLES
    = 'SET_REQUESTING_SUBTITLES';

/**
 * Action to store received subtitles in history.
 */
export const STORE_SUBTITLE = 'STORE_SUBTITLE';

/**
 * The type of (redux) action which indicates that an error occurred while starting subtitles.
 *
 * {
 *      type: SET_SUBTITLES_ERROR,
 *      hasError: boolean
 * }
 */
export const SET_SUBTITLES_ERROR = 'SET_SUBTITLES_ERROR';

/**
 * Action to update the active live captions translation language without toggling captions.
 */
export const SET_SUBTITLES_LANGUAGE = 'SET_SUBTITLES_LANGUAGE';

/**
 * Action to show or hide the live captions panel alongside the video on mobile.
 */
export const SET_SUBTITLES_PANEL_OPEN = 'SET_SUBTITLES_PANEL_OPEN';

/**
 * Action which records which participant turned live captions on.
 *
 * {
 *      type: SET_CAPTIONS_STARTED_BY,
 *      participantId: string
 * }
 */
export const SET_CAPTIONS_STARTED_BY = 'SET_CAPTIONS_STARTED_BY';
