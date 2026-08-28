/**
 * The minimum font size for subtitles.
 */
export const MIN_SUBTITLES_FONT_SIZE = 16;

/**
 * The share of the viewport height taken by the live captions panel when it is shown next to the video.
 */
export const CAPTIONS_PANEL_HEIGHT_RATIO = 0.4;

/**
 * The smallest useful height of the live captions panel, in pixels. Below this the transcript cannot show a line of text
 * together with its controls.
 */
export const CAPTIONS_PANEL_MIN_HEIGHT = 220;

/**
 * The vertical space left free at the bottom of the live captions panel so the toolbar, which floats above it, does not
 * cover the newest caption.
 */
export const CAPTIONS_PANEL_TOOLBAR_RESERVE = 72;

/**
 * When a device which has just joined asks the room again whether captions are already running.
 *
 * Asked three times - once immediately and then twice more - because the bridge channel is frequently not open at the
 * moment a device joins, which is exactly when the question needs asking. Mirrors
 * {@code LATE_JOINER_RESEND_DELAYS_MS} in s2s-v2, which exists for the same reason.
 */
export const CAPTIONS_STATE_REQUEST_DELAYS_MS = [ 0, 2000, 5000 ];

/**
 * When a moderator tells somebody who has only just arrived that captions are already running.
 *
 * Belt and braces alongside the new arrival's own question above: either one arriving is enough, and the two fail in
 * different conditions.
 */
export const CAPTIONS_LATE_JOINER_DELAYS_MS = [ 0, 2000, 5000 ];

/**
 * How long to wait before trying a control message again when neither the bridge channel nor XMPP would take it.
 *
 * Both are unavailable in the same windows - a channel which has not opened yet, a connection being re-established -
 * and both are usually back within a second or two.
 */
export const CAPTIONS_SEND_RETRY_DELAY_MS = 1500;

/**
 * How long a pause closes an utterance and sends it to be transcribed.
 */
export const CAPTIONS_SILENCE_HANGOVER_MS = 1000;

/**
 * The longest a single utterance may run before it is handed over anyway, so that somebody who does not pause is still
 * captioned as they go rather than at the end.
 */
export const CAPTIONS_MAX_UTTERANCE_MS = 15 * 1000;

/**
 * The shortest utterance worth transcribing. Anything briefer is a door, a cough or a keystroke which cleared the
 * detector rather than somebody saying something.
 */
export const CAPTIONS_MIN_UTTERANCE_MS = 300;

/**
 * How long to wait for the transcription service before giving up on an utterance.
 *
 * Utterances are transcribed one after another so that they cannot arrive out of the order they were spoken, which
 * means a request nobody gives up on holds back every sentence behind it.
 */
export const CAPTIONS_TRANSCRIBE_TIMEOUT_MS = 20 * 1000;

/**
 * How long after a caption stops coming out of the loudspeaker an utterance can still be an echo of it.
 *
 * Not a period the microphone is deaf for - it never closes - only the tail of the window in which a transcript is
 * worth comparing against what was read aloud.
 */
export const CAPTIONS_ECHO_TAIL_MS = 400;

/**
 * How long a session waits for a local audio track to appear before deciding there is not going to be one.
 *
 * A track is attached a moment after the conference is joined, and a session started in that moment would otherwise
 * report a microphone problem which does not exist.
 */
export const CAPTIONS_AUDIO_TRACK_GRACE_MS = 1500;

/**
 * The notifications live captions can raise, each under one identifier so that a warning is replaced rather than
 * stacked and can be taken away again.
 */
export const CAPTIONS_MIC_ERROR_UID = 'live-captions-mic';
export const CAPTIONS_TRANSCRIBE_ERROR_UID = 'live-captions-transcribe';

/**
 * How long a caption stays on the stage over the video before it clears itself.
 */
export const CAPTIONS_REMOVE_AFTER_MS = 3000;

/**
 * When a listener tells the room again that it wants, or no longer wants, the transcript feed.
 *
 * Said three times over a few seconds for the same reason the state sync is: the channel it goes on has no
 * acknowledgement and is frequently not open at the moment it is wanted.
 */
export const CAPTIONS_LISTENER_RESEND_DELAYS_MS = [ 0, 1500, 4000 ];

/**
 * The language the transcription service is asked for, and the task it is asked to perform.
 *
 * Whisper's translate task transcribes speech in any language it recognizes and returns English, which is exactly what
 * one shared transcript language needs.
 */
export const CAPTIONS_STT_LANGUAGE = 'en';
export const CAPTIONS_STT_MODE = 'translate';
