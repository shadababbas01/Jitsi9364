import { getCaptionsTtsNativeModule } from '../../caption-tts/functions.native';
import { ITtsVoice } from '../../caption-tts/types';
import { VOICE_FAILURE_LIMIT, VOICE_PITCH_VARIANTS } from '../constants';
import logger from '../logger';

/**
 * How one speaker is read out: which of the engine's voices, at which pitch.
 */
export interface IS2SV2Voice {

    /**
     * The voice to read in, as the engine names it. Absent when the engine would not say which voices it has, or when
     * the one this speaker was given has stopped working: the engine then picks the voice and only the pitch tells
     * this speaker from the next.
     */
    name?: string;

    /**
     * The pitch to read at, where 1 is the engine's own.
     */
    pitch: number;
}

/**
 * The ways this device can read one language, and who has been given which of them.
 */
interface ILanguageVoices {

    /**
     * Which of {@link combinations} each speaker was given. Held per language rather than per speaker, because a
     * device has a different set of voices for every language, and it is also the ledger of what is spoken for: the
     * next speaker takes the entry after the last one handed out, so two speakers sounding alike is impossible rather
     * than unlikely.
     */
    bySpeaker: Map<string, number>;

    /**
     * Every voice at every pitch, in the order they are handed out: all of the voices at the engine's own pitch first,
     * then all of them again at the next pitch. So a room hears a shifted voice only once it has run out of real ones,
     * and a room of two is read in two voices the engine actually ships rather than in one of them twice.
     */
    combinations: IS2SV2Voice[];
}

/**
 * What this device can do with each language, once the engine has been asked. The voices themselves are kept across
 * sessions - they belong to the device rather than to the conversation - while who was given what is not.
 */
const byLanguage = new Map<string, ILanguageVoices>();

/**
 * Which pitch each speaker was given on an engine which would not say what voices it has. The last thing left to tell
 * two speakers apart with, and handed out in order for the same reason the combinations are: the first speaker is read
 * at the engine's own pitch, and nobody is read at a stranger one than the room has speakers to need.
 */
const pitchOnly = new Map<string, number>();

/**
 * How many times each voice has failed to say anything. See {@link VOICE_FAILURE_LIMIT}.
 */
const failures = new Map<string, number>();

/**
 * Orders the voices the engine has for a language, best first.
 *
 * Deliberately the order {@code applyBestVoice} scores them in on the Android side. The first speaker in a room is
 * therefore read in the voice the engine would have used for everybody, and turning this on changes what a room of one
 * sounds like not at all. Ties break on the name so that the order is the same every time it is built: a list which
 * reordered itself would move speakers between voices mid-conversation.
 *
 * @param {ITtsVoice[]} voices - What the engine reported.
 * @param {string} languageTag - The language they were asked for, whose region is preferred.
 * @returns {ITtsVoice[]}
 */
function orderVoices(voices: ITtsVoice[], languageTag: string): ITtsVoice[] {
    const country = languageTag.split('-')[1]?.toUpperCase() ?? '';
    const rank = (voice: ITtsVoice) => [
        country && voice.country?.toUpperCase() === country ? 1 : 0,
        voice.networkRequired ? 1 : 0,
        voice.quality
    ];

    return voices
        .filter(voice => voice.name && !voice.notInstalled)
        .sort((first, second) => {
            const firstRank = rank(first);
            const secondRank = rank(second);

            for (let index = 0; index < firstRank.length; index++) {
                if (firstRank[index] !== secondRank[index]) {
                    return secondRank[index] - firstRank[index];
                }
            }

            return first.name.localeCompare(second.name);
        });
}

/**
 * Returns what this device can do with a language, asking the engine the first time.
 *
 * An empty answer is not remembered. The engine is asked as the first sentence of a session is about to be read out,
 * which is early enough that it can still be warming up, and remembering that it had nothing then would leave the
 * whole session in one voice.
 *
 * @param {string} languageTag - A BCP-47 tag, as the engine takes it.
 * @returns {Promise<ILanguageVoices | undefined>} - Undefined when the engine would not say what it has, which leaves
 * the caller with the pitch as the only way to tell two speakers apart.
 */
async function languageVoicesFor(languageTag: string): Promise<ILanguageVoices | undefined> {
    const known = byLanguage.get(languageTag);

    if (known) {
        return known;
    }

    const getVoices = getCaptionsTtsNativeModule()?.getVoices;

    if (!getVoices) {
        return undefined;
    }

    let voices: ITtsVoice[] = [];

    try {
        voices = orderVoices(await getVoices(languageTag) ?? [], languageTag);
    } catch (error) {
        logger.warn(`Could not ask the speech engine which voices it has for ${languageTag}`, error);

        return undefined;
    }

    if (!voices.length) {
        return undefined;
    }

    const combinations: IS2SV2Voice[] = [];

    for (const pitch of VOICE_PITCH_VARIANTS) {
        for (const voice of voices) {
            combinations.push({
                name: voice.name,
                pitch
            });
        }
    }

    const language = {
        bySpeaker: new Map<string, number>(),
        combinations
    };

    byLanguage.set(languageTag, language);
    logger.info(`The speech engine has ${voices.length} voice(s) for ${languageTag}, so up to ${combinations.length}`
        + ' speakers can be told apart by the sound of them');

    return language;
}

/**
 * Returns which of a language's combinations a speaker is read out in, giving them the next one if they have not been
 * read out in this language before.
 *
 * In the order the room speaks, rather than by anything derived from who they are. Two reasons, and the first is the
 * one that matters: handing them out in order is what makes two speakers sounding alike impossible rather than
 * unlikely, and it spends the real voices before it spends the pitch-shifted ones, so a room of two is read in two
 * voices the device actually ships. Anything computed from the participant ID would agree between devices - which
 * nobody can hear, since every listener hears only their own - at the price of reaching for a shifted voice while good
 * ones sat unused.
 *
 * A speaker who leaves does not give theirs back. Handing a departed speaker's voice to the next person to talk is
 * worse than running an otherwise quiet room out of voices.
 *
 * @param {ILanguageVoices} language - What this device can do with the language.
 * @param {string} speakerId - Who is about to be read out.
 * @returns {number}
 */
function combinationFor(language: ILanguageVoices, speakerId: string): number {
    const existing = language.bySpeaker.get(speakerId);

    if (existing !== undefined) {
        return existing;
    }

    const count = language.combinations.length;
    const index = language.bySpeaker.size % count;

    if (language.bySpeaker.size >= count) {
        // Every voice at every pitch is already somebody's. There is nothing left on this device to be distinct with,
        // which is worth seeing in a log rather than guessing at from a call where two people sound the same.
        logger.warn(`${count} speakers are already being read out in the ${count} ways this device has of reading`
            + ` ${speakerId}'s language; they will sound like one of them`);
    }

    language.bySpeaker.set(speakerId, index);

    return index;
}

/**
 * Returns how a speaker is to be read out, in the language this listener is listening in.
 *
 * Worked out per language, because a device has a different set of voices for each one, and remembered per language
 * too. So a listener who changes language mid-session hears every speaker change voice with them, hears them stay as
 * far apart from each other as they were, and hears the voices they had before if they change back.
 *
 * @param {string} speakerId - Who is about to be read out.
 * @param {string} languageTag - The language they are about to be read out in.
 * @returns {Promise<IS2SV2Voice>}
 */
export async function resolveVoiceForSpeaker(speakerId: string, languageTag: string): Promise<IS2SV2Voice> {
    const language = await languageVoicesFor(languageTag);

    if (!language) {
        let pitch = pitchOnly.get(speakerId);

        if (pitch === undefined) {
            pitch = VOICE_PITCH_VARIANTS[pitchOnly.size % VOICE_PITCH_VARIANTS.length];
            pitchOnly.set(speakerId, pitch);
        }

        return { pitch };
    }

    const combination = language.combinations[combinationFor(language, speakerId)];

    if (combination.name && (failures.get(combination.name) ?? 0) >= VOICE_FAILURE_LIMIT) {
        // Only this speaker moves off it, and they keep the pitch they had: dropping the voice from the list would
        // renumber every combination behind it and change who sounds like what mid-conversation. Two speakers can end
        // up alike here, because a device whose voices will not load has nothing left to promise with.
        return { pitch: combination.pitch };
    }

    return combination;
}

/**
 * Records that a voice did not say what it was given.
 *
 * @param {string} name - The voice which said nothing.
 * @returns {void}
 */
export function noteVoiceFailed(name: string) {
    const count = (failures.get(name) ?? 0) + 1;

    failures.set(name, count);

    if (count === VOICE_FAILURE_LIMIT) {
        logger.warn(`The speech engine will not speak in ${name}; whoever was in it goes back to the default voice`);
    }
}

/**
 * Forgets who sounded like what, at the end of a session.
 *
 * The voices the engine has are kept: they are a property of the device and not of the session, and a new session
 * would only ask for the same lists again.
 *
 * @returns {void}
 */
export function resetVoiceAssignments() {
    pitchOnly.clear();
    failures.clear();

    for (const language of byLanguage.values()) {
        language.bySpeaker.clear();
    }
}
