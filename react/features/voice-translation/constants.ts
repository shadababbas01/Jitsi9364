/**
 * Constants for voice translation feature.
 */

/**
 * Maximum number of participants allowed for voice translation without targeting
 * a specific listener.
 */
export const MAX_VOICE_TRANSLATION_PARTICIPANTS = 2;

/**
 * Default Piper TTS websocket host.
 */
export const DEFAULT_PIPER_TTS_URL = 'wss://ai.live.melp.us/tts/';

/**
 * The data-channel endpoint name used to sync voice translation state.
 */
export const VOICE_TRANSLATION_ENDPOINT = 'voice-translation';

/**
 * Notification timeout for voice translation messages.
 */
export const NOTIFICATION_TIMEOUT_MS = 5000;
