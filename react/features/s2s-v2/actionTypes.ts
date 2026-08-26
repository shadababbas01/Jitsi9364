/**
 * The type of (redux) action which asks for a translated session to begin.
 *
 * Only a moderator's device acts on it: the middleware makes the session identifier, records the session locally and
 * announces it to the meeting. A non-moderator dispatching it changes nothing.
 *
 * {
 *     type: START_S2S_V2_SESSION
 * }
 */
export const START_S2S_V2_SESSION = 'START_S2S_V2_SESSION';

/**
 * The type of (redux) action which asks for the running session to end for everybody.
 *
 * Moderator only, in the same way and for the same reason as {@link START_S2S_V2_SESSION}.
 *
 * {
 *     type: STOP_S2S_V2_SESSION
 * }
 */
export const STOP_S2S_V2_SESSION = 'STOP_S2S_V2_SESSION';

/**
 * The type of (redux) action which records that a session is running, whether this device started it or was told about
 * it.
 *
 * {
 *     type: SET_S2S_V2_SESSION,
 *     sessionId: string,
 *     sourceLanguage: string,
 *     startedBy: string
 * }
 */
export const SET_S2S_V2_SESSION = 'SET_S2S_V2_SESSION';

/**
 * The type of (redux) action which records that no session is running.
 *
 * Clears the session, the popup, the panel and the multiple speaker indicator. Deliberately leaves the transcripts
 * alone - they are what was said, not part of the session - and leaves the two local preferences alone as well.
 *
 * {
 *     type: CLEAR_S2S_V2_SESSION
 * }
 */
export const CLEAR_S2S_V2_SESSION = 'CLEAR_S2S_V2_SESSION';

/**
 * The type of (redux) action which records the language this device wants to hear everybody in.
 *
 * A local preference. It is never sent to anybody: translation happens on the receiving device, so ten listeners in ten
 * languages cost ten local translations and one message on the wire.
 *
 * {
 *     type: SET_S2S_V2_TARGET_LANGUAGE,
 *     targetLanguage: string
 * }
 */
export const SET_S2S_V2_TARGET_LANGUAGE = 'SET_S2S_V2_TARGET_LANGUAGE';

/**
 * The type of (redux) action which records whether this device turns the original voices down underneath the
 * translation. Local, and never sent, for the same reason as the language.
 *
 * {
 *     type: SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE,
 *     suppressOriginalVoice: boolean
 * }
 */
export const SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE = 'SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE';

/**
 * The type of (redux) action which records which of the two ways the panel is drawn.
 *
 * A local preference, like the language and the suppression, and never sent anywhere: how one listener has their own
 * screen set is nobody else's business.
 *
 * {
 *     type: SET_S2S_V2_THEME,
 *     theme: string
 * }
 */
export const SET_S2S_V2_THEME = 'SET_S2S_V2_THEME';

/**
 * The type of (redux) action which shows or hides the language and suppression popup.
 *
 * {
 *     type: SET_S2S_V2_LANGUAGE_POPUP,
 *     visible: boolean
 * }
 */
export const SET_S2S_V2_LANGUAGE_POPUP = 'SET_S2S_V2_LANGUAGE_POPUP';

/**
 * The type of (redux) action which shows or hides the translation panel. Local to the device: closing the panel does
 * not end the session and does not stop the audio.
 *
 * {
 *     type: SET_S2S_V2_PANEL,
 *     visible: boolean
 * }
 */
export const SET_S2S_V2_PANEL = 'SET_S2S_V2_PANEL';

/**
 * The type of (redux) action which shows or hides the moderator's confirmation before stopping.
 *
 * {
 *     type: SET_S2S_V2_STOP_CONFIRM,
 *     visible: boolean
 * }
 */
export const SET_S2S_V2_STOP_CONFIRM = 'SET_S2S_V2_STOP_CONFIRM';

/**
 * The type of (redux) action which records one utterance as it was said, in English.
 *
 * {
 *     type: ADD_S2S_V2_TRANSCRIPT,
 *     messageId: string,
 *     originalText: string,
 *     speakerId: string,
 *     speakerName: string,
 *     timestamp: number
 * }
 */
export const ADD_S2S_V2_TRANSCRIPT = 'ADD_S2S_V2_TRANSCRIPT';

/**
 * The type of (redux) action which records what one utterance came to in the local listener's language.
 *
 * Keyed by the same message ID as the utterance itself, so the translation appears underneath what was said rather than
 * as a second entry of its own.
 *
 * {
 *     type: SET_S2S_V2_TRANSCRIPT_TRANSLATION,
 *     messageId: string,
 *     translatedText: string
 * }
 */
export const SET_S2S_V2_TRANSCRIPT_TRANSLATION = 'SET_S2S_V2_TRANSCRIPT_TRANSLATION';

/**
 * The type of (redux) action which records whether a transcript is currently being translated.
 *
 * Keeps the panel and the participant badges in sync with whatever utterance is in flight right now.
 *
 * {
 *     type: SET_S2S_V2_TRANSCRIPT_TRANSLATING,
 *     messageId: string,
 *     speakerId: string,
 *     translating: boolean
 * }
 */
export const SET_S2S_V2_TRANSCRIPT_TRANSLATING = 'SET_S2S_V2_TRANSCRIPT_TRANSLATING';

/**
 * The type of (redux) action which records which transcript is currently being read aloud.
 *
 * {
 *     type: SET_S2S_V2_TRANSCRIPT_SPEAKING,
 *     messageId: string | null
 * }
 */
export const SET_S2S_V2_TRANSCRIPT_SPEAKING = 'SET_S2S_V2_TRANSCRIPT_SPEAKING';

/**
 * The type of (redux) action which empties this device's transcript history. Local: nobody else's panel changes.
 *
 * {
 *     type: CLEAR_S2S_V2_TRANSCRIPTS
 * }
 */
export const CLEAR_S2S_V2_TRANSCRIPTS = 'CLEAR_S2S_V2_TRANSCRIPTS';

/**
 * The type of (redux) action which records whether more than one person is talking at once.
 *
 * Worked out on each device from the audio levels of the others rather than announced by anybody, so every device
 * arrives at the same answer without a message being sent about it.
 *
 * {
 *     type: SET_S2S_V2_MULTIPLE_SPEAKERS,
 *     detected: boolean
 * }
 */
export const SET_S2S_V2_MULTIPLE_SPEAKERS = 'SET_S2S_V2_MULTIPLE_SPEAKERS';

/**
 * The type of (redux) action which sends one finished utterance to the meeting.
 *
 * Dispatched by the speaking device once its own speech has been transcribed. The middleware shows it locally and
 * broadcasts it in the same breath, because a broadcast never comes back to whoever sent it.
 *
 * {
 *     type: BROADCAST_S2S_V2_TRANSCRIPT,
 *     originalText: string
 * }
 */
export const BROADCAST_S2S_V2_TRANSCRIPT = 'BROADCAST_S2S_V2_TRANSCRIPT';
