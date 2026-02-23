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


// In actionTypes.ts
export const SET_SUBTITLES_LANGUAGE = 'SET_SUBTITLES_LANGUAGE';

// Summary control state
export const SET_SUMMARY_ENABLED = 'SET_SUMMARY_ENABLED';
export const SET_SUMMARY_CATEGORY = 'SET_SUMMARY_CATEGORY';
export const SET_INTERVIEW_CONSENT = 'SET_INTERVIEW_CONSENT';
