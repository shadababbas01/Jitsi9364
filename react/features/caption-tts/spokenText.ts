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

interface ISpokenLine {
    at: number;
    normalized: string;
    words: Set<string>;
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
        normalized,
        words: new Set(normalized.split(' '))
    });
}

/**
 * Returns whether a transcript is the device hearing something it said itself.
 *
 * @param {string} text - The transcript to check.
 * @returns {boolean}
 */
export function wasRecentlySpoken(text?: string | null): boolean {
    const normalized = normalize(text ?? '');

    if (!normalized) {
        return false;
    }

    forget();

    const words = normalized.split(' ');

    return spoken.some(line => {
        if (line.normalized === normalized) {
            return true;
        }

        // One containing the other covers the common case of the microphone catching most, but not all, of what was
        // said. Only when the two are comparable in length: a short answer which happens to appear somewhere inside a
        // sentence that was read out is somebody answering it, not an echo of it.
        const contains = line.normalized.includes(normalized) || normalized.includes(line.normalized);
        const shorter = Math.min(line.normalized.length, normalized.length);
        const longer = Math.max(line.normalized.length, normalized.length);

        if (contains && shorter >= longer * CONTAINMENT_RATIO) {
            return true;
        }

        if (words.length < MIN_WORDS_FOR_OVERLAP) {
            return false;
        }

        const shared = words.filter(word => line.words.has(word)).length;

        return shared / words.length >= ECHO_SIMILARITY;
    });
}

/**
 * Forgets everything. To be called when the conference is over.
 *
 * @returns {void}
 */
export function clearSpokenText() {
    spoken = [];
}
