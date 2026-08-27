/**
 * The name every s2s-v2 endpoint message carries, and the only thing which tells one apart from the other features
 * sharing the same channel. A payload without it is not ours and is dropped without comment.
 */
export const S2S_V2_ENDPOINT = 's2s-v2';

/**
 * The three things the channel can say. A shipped web client is on the other end of every one of them, so these strings
 * are a contract rather than an implementation detail.
 */
export const S2S_V2_SESSION_START = 'session-start';
export const S2S_V2_SESSION_END = 'session-end';
export const S2S_V2_TRANSCRIPT = 'transcript';
export const S2S_V2_PLAYBACK = 'playback';

/**
 * The largest meeting size at which S2S-v2 stays available.
 */
export const MAX_S2S_V2_PARTICIPANTS = 5;

/**
 * The language the speech service is told to expect, when a session does not say otherwise.
 *
 * Sent on {@link S2S_V2_SESSION_START} and used by every device's own transcribe call. There is no control which sets
 * it to anything else yet; it travels anyway so that adding one later needs no change to the protocol.
 */
export const DEFAULT_SOURCE_LANGUAGE = 'en';

/**
 * The language every transcript is carried in, whatever was spoken. The speech service normalizes to English, so the
 * field is a constant rather than a measurement. It travels as a field all the same, so that a future service which
 * returns something else needs no protocol bump.
 */
export const TRANSCRIPT_LANGUAGE = 'en';

/**
 * How many message IDs are remembered for the purpose of recognising one which has already been handled.
 *
 * Bounded, because a long meeting would otherwise grow the set without end. The oldest is forgotten first: a message
 * redelivered after five hundred others have been handled is not a duplicate worth guarding against any more.
 */
export const PROCESSED_MESSAGE_LIMIT = 500;

/**
 * When a running session is announced again to somebody who has only just arrived.
 *
 * The data channel to a participant is frequently not open at the moment they appear, so the announcement is made three
 * times: once immediately and then twice more. Each attempt checks that the session is still running before it is sent,
 * so a session which ended in between says nothing.
 */
export const LATE_JOINER_RESEND_DELAYS_MS = [ 2000, 5000 ];

/**
 * When a listener tells a speaker again that it has started or stopped reading their words out.
 *
 * Said three times for the same reason a session is: the message goes to one participant over a channel which is
 * frequently not open at the moment it is wanted, and there is no acknowledgement to tell the sender it arrived.
 */
export const PLAYBACK_RESEND_DELAYS_MS = [ 1500, 4000 ];

/**
 * Where the speech service is reached. The same deployment the rest of the app synthesizes through: pointing translated
 * speech at a different server than everything else is only ever a mistake.
 */
export const S2S_V2_TTS_URL = 'wss://ai.live.melp.us/tts/';

/**
 * The presence property the meeting uses to show that an S2S v2 utterance is currently being translated.
 *
 * Kept separate from the live translation feature's property so the two can be shown independently.
 */
export const S2S_V2_TRANSLATING_PROPERTY = 's2sV2Translating';

/**
 * The value of {@link S2S_V2_TRANSLATING_PROPERTY} while the local participant's utterance is in flight.
 */
export const S2S_V2_TRANSLATING_ON = 'on';

/**
 * The value of {@link S2S_V2_TRANSLATING_PROPERTY} when nothing is being translated right now.
 */
export const S2S_V2_TRANSLATING_OFF = 'off';

/**
 * How long to wait for the speech service to answer one request before giving up on that sentence.
 *
 * Requests carry no identifier and the service answers them out of a shared pool, so only one is ever in flight and the
 * next frame is unambiguously the answer to it. That is also why a request which is never answered has to time out
 * rather than wait: without this, one lost frame would wedge every sentence behind it for the rest of the session.
 */
export const SYNTHESIS_TIMEOUT_MS = 20 * 1000;

/**
 * How long to wait before opening the speech connection again after it has dropped.
 */
export const TTS_RECONNECT_DELAY_MS = 5 * 1000;

/**
 * How many sentences wait to be spoken.
 *
 * Deliberately short. A busy room produces speech faster than it can be read out, and a backlog only ever falls further
 * behind the conversation: a translation which arrives half a minute after the sentence it translates is worse than one
 * which was dropped. The oldest waiting sentence goes first, because it is the one furthest behind.
 */
export const TTS_QUEUE_LIMIT = 3;

/**
 * How loud a speaker's own voice is left while a session is running and the listener has asked for the original voices
 * to be turned down.
 *
 * A murmur rather than silence, so that it is still audible who is talking and when they have finished, while the
 * translation being read over the top is the thing that can actually be followed.
 */
export const TRANSLATION_DUCKED_VOLUME = 0.05;

/**
 * How loud a speaker's own voice is while this device is reading their translation out.
 *
 * Nothing at all, whatever the listener's preference: their voice and the translation of it are the same sentence
 * twice, and the two together are harder to follow than either alone.
 */
export const PLAYBACK_DUCKED_VOLUME = 0;

/**
 * The volume a participant is heard at when nothing is turning them down.
 */
export const DEFAULT_VOLUME = 1;

/**
 * When the volume of a participant's audio is set again after it has first been set.
 *
 * A track which has only just been added is not playing yet, and a volume set on an audio sink the engine has not
 * created is dropped rather than kept for when it has. Asking again once the participant is actually being heard is
 * what makes it stick.
 */
export const VOLUME_RETRIES_MS = [ 1000, 3000 ];

/**
 * How long a pause closes an utterance and sends it to be transcribed.
 */
export const SILENCE_HANGOVER_MS = 1000;

/**
 * The longest a single utterance may run before it is handed over anyway, so that somebody who does not pause is still
 * transcribed as they go rather than at the end.
 */
export const MAX_UTTERANCE_MS = 15 * 1000;

/**
 * The shortest utterance worth transcribing. Anything briefer is a door, a cough or a keystroke which cleared the
 * detector rather than somebody saying something.
 */
export const MIN_UTTERANCE_MS = 300;

/**
 * How long to wait for the transcription service before giving up on an utterance.
 *
 * Utterances are transcribed one after another so that they cannot arrive out of the order they were spoken, which
 * means a request nobody gives up on holds back every sentence behind it. Sized for the longest utterance the recorder
 * hands over rather than for the worst case a network can produce: past this, waiting costs more than the sentence is
 * worth, and the next thing said is already queued.
 */
export const TRANSCRIBE_TIMEOUT_MS = 20 * 1000;

/**
 * How long to wait before trying a message again when neither the bridge channel nor XMPP would take it.
 *
 * Both are unavailable in the same windows - a channel which has not opened yet, a connection being re-established -
 * and both are usually back within a second or two. Long enough to be past it, short enough that a sentence which does
 * get through is still part of the conversation it belongs to.
 */
export const SEND_RETRY_DELAY_MS = 1500;

/**
 * How long to wait for a translation before showing and speaking the English instead.
 *
 * Without a limit a request which never answers leaves the line reading "Translating…" for the rest of the meeting and,
 * worse, never reaches the speech engine at all - so the listener neither reads it nor hears it. Falling back to what
 * was actually said is the lesser loss.
 */
export const TRANSLATE_TIMEOUT_MS = 10 * 1000;

/**
 * How long after a translation stops coming out of the loudspeaker an utterance can still be an echo of it.
 *
 * No longer a period the microphone is deaf for - a session is full duplex and the microphone never closes - only the
 * tail of the window in which a transcript is worth comparing against what was read aloud. The loudspeaker stops
 * before the room does, so a sentence handed over just after playback ended may still hold the end of it.
 */
export const ECHO_TAIL_MS = 400;

/**
 * How many of the room's most recent utterances a local transcript is checked against before it is broadcast.
 *
 * A count rather than a span of time, because the timestamps on the entries are the clocks of the devices which sent
 * them: comparing one against this device's clock measures the difference between two phones as much as the age of
 * what was said. A count is skew-proof and bounds the work, and an echo is always among the last few things anybody
 * said in any case.
 */
export const ECHO_ROOM_LOOKBACK = 20;

/**
 * How long a session waits for a local audio track to appear before deciding there is not going to be one.
 *
 * A track is attached a moment after the conference is joined, and a session started in that moment would otherwise
 * report a microphone problem which does not exist.
 */
export const AUDIO_TRACK_GRACE_MS = 1500;

/**
 * The audio level above which a remote participant counts as talking, for the purpose of noticing that two people are
 * talking at once.
 *
 * Deliberately coarser than the capture detector's: this only has to notice overlapping speech, not decide whether to
 * spend a network request on a segment.
 */
export const SPEAKING_LEVEL_THRESHOLD = 0.02;

/**
 * How long a participant has to stay quiet before they stop counting as talking. Without it the indicator flickers on
 * every pause between words.
 */
export const SPEAKING_HANGOVER_MS = 1200;

/**
 * How much of the screen the panel takes: half of it, with the video keeping the other half.
 *
 * A share of the screen rather than a fixed number of pixels, so that the split reads the same on a small phone as on
 * a large one. Deliberately without a floor: a floor would quietly become more than half the screen on a short one,
 * which is the one case it would be there to handle.
 */
export const S2S_V2_PANEL_HEIGHT_RATIO = 0.5;

/**
 * The notifications the feature can raise, each under one identifier so that a warning is replaced rather than stacked
 * and can be taken away again.
 */
export const S2S_V2_MIC_ERROR_UID = 's2s-v2-mic';
export const S2S_V2_TRANSCRIBE_ERROR_UID = 's2s-v2-transcribe';
export const S2S_V2_TTS_ERROR_UID = 's2s-v2-tts';

/**
 * What to offer while the language list is being fetched, or if fetching it fails, so that a session can still be
 * joined and listened to on a bad connection.
 */
export const S2S_V2_FALLBACK_LANGUAGE_CODES = [ 'en', 'hi', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'pt', 'ru' ];
