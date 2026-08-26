/**
 * The endpoint which turns an utterance into text. It takes the audio as a {@code multipart/form-data} part named
 * {@code audio}, alongside {@code mode}, {@code language} and {@code message_id} fields, and answers with a
 * {@code results} array holding one entry per file.
 *
 * The same deployment serves the speech synthesis the caption read aloud feature uses, which is why this is not
 * configurable: pointing the two at different servers is only ever a mistake.
 */
export const MELP_TRANSCRIBE_URL = 'https://ai.live.melp.us/msgtrans/transcribe';

/**
 * The socket which turns recorded WAVs into text, and the primary way this is done.
 *
 * It replaces the request-per-utterance endpoint which used to live at port 5001 under {@code /transcribe/text}. A
 * translated call sends an utterance every few seconds for its whole length, and one connection held open for the call
 * costs a great deal less than a TLS handshake per sentence. The endpoint above remains as the fallback for when the
 * socket cannot be reached at all.
 *
 * The mode, the language and the token go on the query string, since a WebSocket handshake opened from JavaScript cannot
 * carry headers of its own. See {@code MelpSttClient} for what travels over it once it is open.
 */
export const MELP_TRANSCRIBE_WS_URL = 'wss://ai.live.melp.us/stt/ws/transcribe';

/**
 * Prefixes every line written about the life of the transcription connection, wherever it is written from, so that the
 * whole story can be read out of a device log with one filter on it: {@code adb logcat | grep '\[stt\]'}.
 */
export const STT_LOG_TAG = '[stt]';

/**
 * How long to wait for the socket to open before deciding the service is not there.
 *
 * Shorter than a transcription takes: this is a handshake against a service which is either up or is not, and an
 * utterance waiting on it is an utterance the fallback could already have transcribed.
 */
export const TRANSCRIBE_WS_CONNECT_TIMEOUT_MS = 8 * 1000;

/**
 * How long to wait before opening the socket again after it has dropped.
 *
 * Every utterance in the meantime goes to the fallback, so this is the cost of a reconnect rather than of an outage.
 */
export const TRANSCRIBE_WS_RECONNECT_DELAY_MS = 5 * 1000;

/**
 * How often an idle connection is pinged to prove it is still there.
 *
 * A socket which nothing has been sent on for a while can be taken away without either end being told: a proxy closes
 * it on its idle timeout, or the phone moves from wifi to cellular and the old path simply stops existing. Neither
 * produces a close event, so the socket goes on reporting itself open, the reconnect never runs, and every utterance
 * after that is dropped for the rest of the call. A frame which gets an answer, or fails to send, is the only way to
 * tell an open socket from one which merely looks open.
 *
 * More likely on a phone than anywhere else, which is why it is here rather than left to the close handler: an app
 * backgrounded, a doze, a handover between networks are all ordinary and all produce exactly this.
 */
export const TRANSCRIBE_WS_HEARTBEAT_MS = 20 * 1000;

/**
 * How much speech goes into one caption. Long enough that the service has a sentence to work with rather than a
 * fragment, short enough that a caption still lands while the room remembers what was said.
 */
export const CAPTION_WINDOW_MS = 10 * 1000;

/**
 * How long to wait before recording again after the microphone could not be opened, which happens while another part of
 * the application is holding it.
 */
export const CAPTION_WINDOW_RETRY_MS = 2 * 1000;

/**
 * The mode asked of the service. Whisper's translate task transcribes speech in any language it recognizes and returns
 * it in English, which is exactly what a single shared caption language needs; {@code transcribe} would return each
 * speaker's own language instead and leave the translating to the caption UI.
 */
export const TRANSCRIBE_MODE = 'translate';

/**
 * The language the service is asked to return. It goes together with {@link TRANSCRIBE_MODE}: the translate task only
 * targets English, so asking for anything else here silently gets English anyway.
 */
export const TRANSCRIBE_LANGUAGE = 'en';

/**
 * The language every caption produced here is tagged with, so that the caption UI and the read aloud feature know what
 * they are looking at without having to ask the service.
 */
export const TRANSCRIBED_LANGUAGE_TAG = 'en';

/**
 * How long a pause ends one utterance and starts the next one.
 *
 * Short enough that captions land right after the speaker stops, long enough to avoid splitting normal word gaps into
 * separate requests.
 */
export const SILENCE_HANGOVER_MS = 1000;

/**
 * The longest utterance the recorder will hand over without a pause, so a monologue is still transcribed as it goes
 * rather than only after the speaker finally stops.
 */
export const MAX_UTTERANCE_MS = 15 * 1000;

/**
 * The shortest utterance worth transcribing. Anything briefer is likely a cough, a keyboard tap, or background noise
 * rather than a sentence.
 */
export const MIN_UTTERANCE_MS = 300;

/**
 * How long to wait for the service to transcribe an utterance before giving up on it. An utterance which takes longer
 * than this is far enough behind the conversation that its caption would land under the wrong sentence.
 */
export const TRANSCRIBE_TIMEOUT_MS = 15 * 1000;

/**
 * How many utterances may be transcribed at the same time. Speech arrives faster than a single request can be served
 * when someone talks in short bursts, and letting two overlap keeps the captions close to the speaker without turning
 * a conversation into a burst of requests.
 */
export const MAX_CONCURRENT_REQUESTS = 2;

/**
 * How many utterances may wait for a free slot. Once this is full the oldest waiting utterance is dropped: a backlog
 * only ever grows further behind the live conversation, and a caption which arrives half a minute late is worse than
 * no caption at all.
 */
export const MAX_PENDING_UTTERANCES = 4;

/**
 * How long the utterances behind an unsettled one wait for it before they are let through out of order.
 *
 * Captions are held back so they read in the order they were spoken, but a single request which is slow or stuck must
 * not be able to freeze the transcript: past this, a caption in the wrong place is the better failure. Comfortably
 * longer than {@link TRANSCRIBE_TIMEOUT_MS} plus one retry, so this only ever fires for something genuinely wedged.
 */
export const ORDER_STALL_MS = 20 * 1000;

/**
 * How many times an utterance is resent after a network failure. Speech is only worth one retry; past that the
 * conversation has moved on.
 */
export const MAX_RETRIES = 1;

/**
 * How long to wait before resending an utterance which failed.
 */
export const RETRY_DELAY_MS = 500;

/**
 * The endpoint message type carrying a caption produced on a participant's own device to everyone else in the room.
 *
 * Deliberately not the {@code transcription-result} type the Jigasi transcriber uses: that one is only accepted from
 * hidden participants, and reusing it would mean loosening a check which exists so that an ordinary participant cannot
 * put words in the transcriber's mouth.
 */
export const JSON_TYPE_LOCAL_TRANSCRIPTION = 'local-transcription-result';

/**
 * The longest caption text accepted from a remote participant, in characters. Nothing a person says in
 * {@code MAX_UTTERANCE_MS} comes close, so anything longer is a malformed or hostile message rather than speech.
 */
export const MAX_REMOTE_TEXT_LENGTH = 2000;
