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
 * The endpoint which turns a recorded WAV straight into text, with no upload step in front of it. It takes the audio as
 * a {@code multipart/form-data} part named {@code audio} alongside {@code mode} and {@code language}, and answers with
 * the transcript as a bare body: plain text, not JSON, so nothing about the answer is parsed.
 */
export const MELP_TRANSCRIBE_TEXT_URL = 'https://ai.live.melp.us:5001/transcribe/text';

/**
 * The mode {@link MELP_TRANSCRIBE_TEXT_URL} is asked for. Unlike {@link TRANSCRIBE_MODE} this transcribes speech in the
 * language it was spoken in rather than translating it to English.
 */
export const TRANSCRIBE_TEXT_MODE = 'transcribe';

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
