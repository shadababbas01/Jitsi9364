/**
 * The type of (redux) action which turns the live translation call on or off.
 *
 * {
 *      type: SET_LIVE_TRANSLATION_ACTIVE,
 *      active: boolean
 * }
 */
export const SET_LIVE_TRANSLATION_ACTIVE = 'SET_LIVE_TRANSLATION_ACTIVE';

/**
 * The type of (redux) action which opens or closes the microphone the live translation call listens through, without
 * leaving the call itself.
 *
 * {
 *      type: SET_LIVE_TRANSLATION_MIC,
 *      micOn: boolean
 * }
 */
export const SET_LIVE_TRANSLATION_MIC = 'SET_LIVE_TRANSLATION_MIC';

/**
 * The type of (redux) action which records that the local participant is speaking right now, as heard by the recorder.
 *
 * {
 *      type: SET_LIVE_TRANSLATION_DICTATING,
 *      dictating: boolean
 * }
 */
export const SET_LIVE_TRANSLATION_DICTATING = 'SET_LIVE_TRANSLATION_DICTATING';

/**
 * The type of (redux) action which records how many utterances are on their way to being transcribed and sent.
 *
 * {
 *      type: SET_LIVE_TRANSLATION_PENDING,
 *      pending: number
 * }
 */
export const SET_LIVE_TRANSLATION_PENDING = 'SET_LIVE_TRANSLATION_PENDING';

/**
 * The type of (redux) action which records that something went wrong, so the panel can say so.
 *
 * {
 *      type: SET_LIVE_TRANSLATION_ERROR,
 *      error: string | null
 * }
 */
export const SET_LIVE_TRANSLATION_ERROR = 'SET_LIVE_TRANSLATION_ERROR';
