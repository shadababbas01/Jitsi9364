import { SPEAKER_INTRO_UTTERANCES } from '../constants';

/**
 * The longest name worth reading out in front of a sentence.
 *
 * A display name is not always a name - it is whatever somebody typed, and it can be a name, a title and a company.
 * Reading all of it out in front of four sentences would say more about the label than about what was said.
 */
const MAX_SPOKEN_NAME_LENGTH = 24;

/**
 * The word between the name and the sentence.
 *
 * English, whatever language the sentence behind it is in: it is a word every listener hears in front of four
 * sentences and nowhere else, and it says which of the two halves is a name. Translating it per language, so that a
 * Hindi listener hears the Hindi for it, is the obvious next step and needs a word per language to do it with.
 */
const SPEAKER_INTRO_VERB = 'says';

/**
 * How many of each speaker's sentences have been read out with their name in front of them.
 */
const introduced = new Map<string, number>();

/**
 * Returns the part of a display name worth speaking, if any of it is.
 *
 * A name too long to read out is cut back to its first word, which is what somebody would have said anyway. Nothing at
 * all comes back for a participant who never set a name: the meeting's stand-in for one is no use as an introduction,
 * and "Fellow Jitsi'er, hello" is worse than "hello".
 *
 * @param {string} speakerName - The name the speaker goes by, if they have one.
 * @returns {string | undefined}
 */
function toSpokenName(speakerName?: string): string | undefined {
    const name = (speakerName ?? '').replace(/\s+/g, ' ').trim();

    if (!name) {
        return undefined;
    }

    if (name.length <= MAX_SPOKEN_NAME_LENGTH) {
        return name;
    }

    return name.split(' ')[0].slice(0, MAX_SPOKEN_NAME_LENGTH);
}

/**
 * Returns what to read out in front of a speaker's next sentence, while they still have introductions left.
 *
 * The name and {@link SPEAKER_INTRO_VERB}, e.g. {@code Shadab says}, which the caller puts in front of the sentence.
 *
 * A look rather than a count: the engine can fail to say a sentence, and an introduction nobody heard should not be
 * one of the four. Spending one is what {@link noteIntroSpoken} is for.
 *
 * @param {string} speakerId - Who is about to be read out.
 * @param {string} speakerName - The name they go by, if they have one.
 * @returns {string | undefined} - Undefined once they have been introduced enough, or when there is no name to use.
 */
export function introFor(speakerId: string, speakerName?: string): string | undefined {
    if ((introduced.get(speakerId) ?? 0) >= SPEAKER_INTRO_UTTERANCES) {
        return undefined;
    }

    const name = toSpokenName(speakerName);

    return name && `${name} ${SPEAKER_INTRO_VERB}`;
}

/**
 * Records that a speaker has been introduced once more.
 *
 * @param {string} speakerId - Who was introduced.
 * @returns {void}
 */
export function noteIntroSpoken(speakerId: string) {
    introduced.set(speakerId, (introduced.get(speakerId) ?? 0) + 1);
}

/**
 * Forgets who has been introduced, at the end of a session.
 *
 * The next session introduces everybody again, and should: it is a different conversation, and a listener who has
 * heard nobody yet has no way of telling one voice from another.
 *
 * @returns {void}
 */
export function resetSpeakerIntros() {
    introduced.clear();
}
