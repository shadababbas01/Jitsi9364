/**
 * Takes back out of the text the moment of audio a forced split repeats.
 *
 * Somebody who talks past the length cap without pausing is cut at an arbitrary instant, which lands in the middle of
 * a word as often as not, and half a word transcribes to nothing on both sides of the cut. The recorder therefore
 * repeats the last moment of the chunk it closed at the head of the one it opens, so the word is whole in one of them.
 * That repetition is correct in the audio and wrong in the transcript, and this is where it comes back out.
 */

/**
 * How far into the two chunks to look for the seam.
 *
 * The repeated audio is a fraction of a second, so the words it can hold are few. Looking further only finds
 * coincidences: a speaker who says the same handful of words twice a minute apart is repeating themselves, not being
 * transcribed twice.
 */
const MAX_OVERLAP_WORDS = 8;

/**
 * Reduces a word to what can be compared, so that punctuation and casing cannot hide a seam. Letters and digits of
 * every script are kept, so a transcript in any language survives this.
 *
 * @param {string} word - The word to reduce.
 * @returns {string}
 */
function normalize(word: string): string {
    return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Returns the second half of a forced split with the words it repeats from the first half removed.
 *
 * The seam is found by taking the longest run of words which ends the previous chunk and begins this one. Longest
 * rather than first, because a short run is far likelier to be a coincidence than a long one, and the audio which was
 * repeated was one continuous stretch rather than several.
 *
 * @param {string} previous - What the chunk before this one came back as.
 * @param {string} next - What this chunk came back as.
 * @returns {string} The text to keep, which is the whole of {@code next} when no seam is found.
 */
export function removeTranscriptBoundaryOverlap(previous?: string | null, next?: string | null): string {
    const tail = (previous ?? '').trim().split(/\s+/)
        .filter(Boolean);
    const head = (next ?? '').trim().split(/\s+/)
        .filter(Boolean);

    if (!tail.length || !head.length) {
        return (next ?? '').trim();
    }

    const reach = Math.min(MAX_OVERLAP_WORDS, tail.length, head.length);

    for (let length = reach; length > 0; length--) {
        const ending = tail.slice(-length).map(normalize);
        const beginning = head.slice(0, length).map(normalize);

        if (ending.every((word, index) => word && word === beginning[index])) {
            return head.slice(length).join(' ');
        }
    }

    return head.join(' ');
}
