/**
 * What a speech recognizer returns when there was nothing to recognize.
 *
 * Handed audio which holds no speech, or too little of it, Whisper does not answer with nothing. It answers with the
 * most likely thing to follow silence in what it was trained on, which was captioned video: the sign-off of a talk, the
 * credits of a subtitle file, a request to subscribe. On a translated call that reaches the meeting as a message, and
 * the other side reads it out loud, so a sentence nobody said is worse than no sentence at all.
 *
 * Every rule here was written against output this deployment actually produced for recordings taken off a real call:
 * "Thank you." for fourteen seconds of a quiet room, "to follow me on Twitter." and "Thank you." for second-long
 * fragments, and "Hello, hello, hello. Hello to all the multiple people speaking instead of doing error. Hello, hello,
 * hello..." carrying on to the length limit.
 */

/**
 * Lines which are never a turn in a meeting, whatever the audio behind them was.
 */
const NEVER_SAID = [
    'thanks for watching',
    'thank you for watching',
    'thanks for watching this video',
    'thank you for watching this video',
    'please subscribe',
    'please subscribe to my channel',
    'like and subscribe',
    'subscribe to my channel',
    'to follow me on twitter',
    'follow me on twitter',
    'see you in the next video',
    'see you next time',
    'the end',
    'music',
    'applause',
    'laughter',
    'silence',
    'blank audio',
    'inaudible',
    'foreign',
    'you',
    'amara org',
    'subtitles by the amara org community',
    'subtitles by',
    'transcription by castingwords',
    'transcription by',
    'copyright'
];

/**
 * The shapes those lines come in, for the ones which vary. Matched against the whole transcript, never inside it: a
 * sentence which mentions subscribing is somebody talking about subscribing.
 */
const NEVER_SAID_PATTERNS = [
    /^(please |don'?t forget to )?(like and )?subscribe( to (my|the) channel)?$/,
    /^(thanks?|thank you)( so much| very much)? for watching.*$/,
    /^(do not|don'?t) forget to.*(like|subscribe|comment).*$/,
    /^subtitles? (by|and translation by|provided by).*$/,
    /^(transcription|translation|captions?) by.*$/,
    /^\[.*\]$/,
    /^\(.*\)$/,
    /^♪+.*♪*$/
];

/**
 * The other half of what a recognizer produces for silence: lines which are also things people say.
 *
 * "Thank you", "okay" and "yeah" are among the commonest things Whisper returns for an empty room, and each is also a
 * whole turn in a conversation - often the only thing somebody says. They are refused only when the recording behind
 * them was too short to have held a real answer, which is something the device knows and the service never sees.
 */
const SILENCE_REPLIES = [
    'thank you',
    'thanks',
    'thank you very much',
    'okay',
    'ok',
    'all right',
    'alright',
    'bye',
    'bye bye',
    'goodbye',
    'yeah',
    'yes',
    'no',
    'oh',
    'so',
    'well',
    'hmm',
    'mm',
    'mm hmm',
    'uh',
    'uh huh',
    'um',
    'right',
    'i see'
];

/**
 * How short a recording has to be before one of those is taken for a guess rather than an answer. A spoken "thank you"
 * arrives in a recording of a second and a half or more once the pause which ended it is counted; anything shorter than
 * this barely held a word.
 */
const SHORT_RECORDING_MS = 1800;

/**
 * The fastest anybody speaks, as milliseconds of recording per word.
 *
 * The general form of the check, and the one which needs no list: a recognizer which invents a sentence invents it out
 * of a recording too short to have held it. Set well beyond human speech - six or seven words a second is already
 * exceptional - so that only the impossible is refused.
 */
const MIN_MS_PER_WORD = 110;

/**
 * The slowest anybody speaks, as milliseconds of recording per word.
 *
 * The mirror of {@code MIN_MS_PER_WORD}, and the rule which catches the quiet kind of hallucination: a recording of
 * fourteen seconds which comes back as "Thank you." is not fourteen seconds in which somebody said two words, it is
 * fourteen seconds the recognizer could not read. Set at one word per three seconds, which is slower than anybody
 * speaks even with pauses, so that a real short answer inside a long recording still survives.
 */
const MAX_MS_PER_WORD = 3000;

/**
 * How long a recording has to be before it can be judged too slow for what came back. Below this the measure means
 * nothing: two words in two seconds is somebody answering.
 */
const MIN_MS_FOR_RATE = 5000;

/**
 * How much of a transcript one word may be before the recognizer is taken to have got stuck on it. Counting distinct
 * words alone misses a loop with a sentence in the middle of it; counting how far the commonest word runs away with the
 * transcript does not.
 */
const MAX_DOMINANT_SHARE = 0.4;

/**
 * How few distinct words a transcript may be made of, for the plainer kind of loop.
 */
const MIN_DISTINCT_SHARE = 0.25;

/**
 * How long a transcript has to be before it is worth looking for a loop in it at all. Below this, repetition is
 * ordinary: "no, no, no" is somebody answering.
 */
const MIN_WORDS_FOR_LOOP = 8;

/**
 * Reduces a transcript to the words that carry it, so that punctuation and casing cannot hide a match. Letters and
 * digits of every script are kept, so that a transcript in Urdu, Hindi or any other language survives this untouched.
 *
 * @param {string} text - The transcript.
 * @returns {string}
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Returns whether a transcript is what the recognizer says when it heard nothing, rather than anything somebody said.
 *
 * @param {string} text - The transcript the service returned.
 * @param {number} durationMs - How long the recording behind it was, where the caller knows. Without it only the
 * transcript itself can be judged, which catches less.
 * @returns {boolean}
 */
export function isHallucinatedTranscript(text?: string | null, durationMs?: number): boolean {
    const normalized = normalize(text ?? '');

    // Nothing, or a stray mark which normalized away to nothing.
    if (normalized.length < 2) {
        return true;
    }

    if (NEVER_SAID.includes(normalized)) {
        return true;
    }

    const raw = (text ?? '').trim().toLowerCase();

    if (NEVER_SAID_PATTERNS.some(pattern => pattern.test(normalized) || pattern.test(raw))) {
        return true;
    }

    const words = normalized.split(' ');

    // Nobody said this many words in this little audio, whatever the words were.
    if (durationMs !== undefined && words.length > 1 && durationMs < words.length * MIN_MS_PER_WORD) {
        return true;
    }

    // A line which is only a guess when there was nothing behind it.
    if (durationMs !== undefined && durationMs < SHORT_RECORDING_MS && SILENCE_REPLIES.includes(normalized)) {
        return true;
    }

    // And nobody speaks this slowly either. Seconds of recording which come back as a word or two are seconds the
    // recognizer could not read, not seconds in which nothing was said.
    if (durationMs !== undefined && durationMs >= MIN_MS_FOR_RATE && words.length < durationMs / MAX_MS_PER_WORD) {
        return true;
    }

    if (words.length < MIN_WORDS_FOR_LOOP) {
        return false;
    }

    const counts = new Map<string, number>();

    for (const word of words) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
    }

    // Stuck on one word, however much else it managed to say around it.
    if (Math.max(...counts.values()) > words.length * MAX_DOMINANT_SHARE) {
        return true;
    }

    return counts.size <= Math.ceil(words.length * MIN_DISTINCT_SHARE);
}
