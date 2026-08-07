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

/**
 * The type of (redux) action which indicates whose chat message is currently being read aloud, so that the UI can show
 * that participant speaking.
 *
 * {
 *      type: SET_CHAT_TTS_SPEAKER,
 *      participantId: string | null,
 *      speaking: boolean
 * }
 */
export const SET_CHAT_TTS_SPEAKER = 'SET_CHAT_TTS_SPEAKER';
