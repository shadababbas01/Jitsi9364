/**
 * What the device has said out loud lately, so that hearing itself back can be recognised for what it is.
 *
 * The microphone is deliberately not closed while a message is read aloud - a translated call has to stay full duplex, so
 * that somebody can answer without waiting for the previous translation to finish - which leaves this and the platform
 * echo canceller as the whole defence rather than as a backstop behind a gate. Anything transcribed which matches what
 * was just spoken is the device hearing itself, not somebody talking, and must not be sent back to the meeting: the
 * other side would read it aloud, their microphone would hear that, and the two would talk past each other
 * indefinitely.
 */

/**
 * How long a spoken line stays worth comparing against. An echo comes back within a second or two of being spoken, plus
 * however long the transcription takes; well beyond that the same words are somebody genuinely repeating themselves.
 */
const SPOKEN_TTL_MS = 30 * 1000;

/**
 * How many lines are kept. Long enough for a burst of messages, small enough to compare against for free.
 */
const SPOKEN_LIMIT = 20;

/**
 * How much of a transcript's words have to be words which were just spoken for it to count as an echo. Not 1, because
 * transcription of the device's own voice is imperfect and drops or mangles the odd word.
 */
const ECHO_SIMILARITY = 0.7;

/**
 * Comparing anything shorter than this by word overlap is meaningless: "yes" matches "yes" whoever said it, and dropping
 * it would lose a real answer. Short lines are only dropped on an exact match.
 */
const MIN_WORDS_FOR_OVERLAP = 4;

/**
 * How much of a spoken line a transcript has to account for before one containing the other counts as an echo.
 *
 * Containment on its own is far too eager. What gets read aloud is whole sentences, and the commonest things anybody
 * says in reply - "yes", "tomorrow", "that works for me" - appear inside one of them constantly. Without this, a
 * translated call silently drops most of the short answers in it, which is indistinguishable from the microphone not
 * working. Requiring the two to be comparable in length keeps what containment is actually for: the microphone catching
 * most, but not all, of a line the device just said.
 */
const CONTAINMENT_RATIO = 0.6;

/**
 * The same two measures, for a caller which is comparing against speech recorded while the loudspeaker was going.
 *
 * Far tighter, because that is the one case where the thing being compared is usually not an echo at all. Somebody who
 * speaks over a translation is almost always answering it, and an answer is made of the words of the question: "yes, I
 * can see your screen" against "can everyone see my screen" shares most of its short words with the line it replies to.
 * The loose measures exist for a microphone catching a line imperfectly, and applied to a reply they throw away the
 * conversation.
 */
const STRICT_ECHO_SIMILARITY = 0.85;
const STRICT_CONTAINMENT_RATIO = 0.8;

/**
 * How alike in length two lines have to be before word overlap is allowed to call one an echo of the other, when the
 * strict measures are in force.
 *
 * The discriminator the overlap rule lacks on its own. An echo of a sentence is about as long as the sentence, because
 * it is the same sentence heard again; a reply to it is a different length, usually shorter. Comparing lengths costs
 * nothing and separates the two cases the word counts cannot.
 */
const STRICT_LENGTH_RATIO = 0.7;

interface ISpokenLine {
    at: number;
    normalized: string;
}

let spoken: ISpokenLine[] = [];

/**
 * Reduces a line to the words that carry it, so that punctuation, casing and spacing cannot make an echo look different
 * from what was spoken.
 *
 * @param {string} text - The line to normalize.
 * @returns {string}
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"“”‘’()[\]{}…—–\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Drops the lines which are too old to be an echo of anything.
 *
 * @returns {void}
 */
function forget() {
    const cutoff = Date.now() - SPOKEN_TTL_MS;

    spoken = spoken.filter(line => line.at >= cutoff).slice(-SPOKEN_LIMIT);
}

/**
 * Remembers a line the device is about to say out loud.
 *
 * @param {string} text - The line being spoken.
 * @returns {void}
 */
export function rememberSpokenText(text?: string | null) {
    const normalized = normalize(text ?? '');

    if (!normalized) {
        return;
    }

    forget();
    spoken.push({
        at: Date.now(),
        normalized
    });
}

/**
 * Returns whether one line of text is the same thing said again as another, closely enough to be an echo of it rather
 * than somebody's own words.
 *
 * Separate from {@link wasRecentlySpoken} because the memory of what this device said out loud is not the only thing
 * worth comparing a transcript against - what everybody else in the room has just said is another, and it catches the
 * case this list cannot: a remote participant's own voice coming out of the loudspeaker and being transcribed as though
 * the local user had said it.
 *
 * Normalizing an already normalized string changes nothing, so callers holding either form can pass what they have.
 *
 * @param {string} candidate - The transcript in question.
 * @param {string} previous - Something said earlier, by this device or by somebody in the room.
 * @param {boolean} strict - Whether to use the tighter measures, which are for a transcript recorded while the
 * loudspeaker was going and therefore far more likely to be an answer to the line than a repeat of it.
 * @returns {boolean}
 */
export function isEchoOfSpokenText(
        candidate?: string | null,
        previous?: string | null,
        strict = false): boolean {
    const heard = normalize(candidate ?? '');
    const said = normalize(previous ?? '');

    if (!heard || !said) {
        return false;
    }

    if (heard === said) {
        return true;
    }

    const shorter = Math.min(said.length, heard.length);
    const longer = Math.max(said.length, heard.length);

    // One containing the other covers the common case of the microphone catching most, but not all, of what was said.
    // Only when the two are comparable in length: a short answer which happens to appear somewhere inside a sentence
    // that was read out is somebody answering it, not an echo of it.
    const contains = said.includes(heard) || heard.includes(said);

    if (contains && shorter >= longer * (strict ? STRICT_CONTAINMENT_RATIO : CONTAINMENT_RATIO)) {
        return true;
    }

    const words = heard.split(' ');

    if (words.length < MIN_WORDS_FOR_OVERLAP) {
        return false;
    }

    // An echo of a sentence is about as long as the sentence. A reply to it is not, and a reply is what speech
    // recorded over a loudspeaker usually is.
    if (strict && shorter < longer * STRICT_LENGTH_RATIO) {
        return false;
    }

    const earlier = new Set(said.split(' '));
    const shared = words.filter(word => earlier.has(word)).length;

    return shared / words.length >= (strict ? STRICT_ECHO_SIMILARITY : ECHO_SIMILARITY);
}

/**
 * Returns the line this device said out loud which a transcript is an echo of, or null if it is not an echo of any of
 * them.
 *
 * The same question {@link wasRecentlySpoken} answers, answered with the evidence rather than with a yes. A sentence
 * which never reaches the meeting is the hardest kind of fault to look into, and knowing which line it was held against
 * is the difference between reading a log and guessing at one.
 *
 * @param {string} text - The transcript to check.
 * @param {boolean} strict - Whether to use the tighter measures, for speech recorded over the loudspeaker.
 * @returns {string | null}
 */
export function findRecentlySpokenMatch(text?: string | null, strict = false): string | null {
    const normalized = normalize(text ?? '');

    if (!normalized) {
        return null;
    }

    forget();

    return spoken.find(line => isEchoOfSpokenText(normalized, line.normalized, strict))?.normalized ?? null;
}

/**
 * Returns whether a transcript is the device hearing something it said itself.
 *
 * @param {string} text - The transcript to check.
 * @param {boolean} strict - Whether to use the tighter measures, for speech recorded over the loudspeaker.
 * @returns {boolean}
 */
export function wasRecentlySpoken(text?: string | null, strict = false): boolean {
    return findRecentlySpokenMatch(text, strict) !== null;
}

/**
 * Forgets everything. To be called when the conference is over.
 *
 * @returns {void}
 */
export function clearSpokenText() {
    spoken = [];
}
