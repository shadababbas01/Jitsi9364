/**
 * The type of (redux) action which indicates whether the local microphone is being captured and transcribed.
 *
 * {
 *      type: SET_LIVE_TRANSCRIBE_RUNNING,
 *      running: boolean
 * }
 */
export const SET_LIVE_TRANSCRIBE_RUNNING = 'SET_LIVE_TRANSCRIBE_RUNNING';

/**
 * The type of (redux) action which indicates that the transcription service could not be reached, so that the UI can
 * say so rather than leaving the local user waiting for captions which will not come.
 *
 * {
 *      type: SET_LIVE_TRANSCRIBE_ERROR,
 *      error: string | null
 * }
 */
export const SET_LIVE_TRANSCRIBE_ERROR = 'SET_LIVE_TRANSCRIBE_ERROR';
