/**
 * The type of (redux) action which indicates whether a caption is currently being read aloud.
 *
 * {
 *      type: SET_CAPTION_TTS_SPEAKING,
 *      speaking: boolean
 * }
 */
export const SET_CAPTION_TTS_SPEAKING = 'SET_CAPTION_TTS_SPEAKING';

/**
 * The type of (redux) action which indicates that the device text-to-speech engine cannot speak the selected caption
 * language.
 *
 * {
 *      type: SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE,
 *      language: string | null
 * }
 */
export const SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE = 'SET_CAPTION_TTS_UNSUPPORTED_LANGUAGE';
