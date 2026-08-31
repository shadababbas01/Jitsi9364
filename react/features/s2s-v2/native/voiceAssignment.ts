import { getCaptionsTtsNativeModule } from '../../caption-tts/functions.native';
import { ITtsVoice } from '../../caption-tts/types';
import {
    VOICE_FAILURE_LIMIT,
    VOICE_PITCH_VARIANTS,
    VOICE_SLOT_COUNT
} from '../constants';
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
 * Which slot each speaker was given, for as long as the session lasts.
 */
const slots = new Map<string, number>();

/**
 * The slots which are spoken for, so that two speakers whose IDs happen to want the same one do not get it.
 */
const takenSlots = new Set<number>();

/**
 * The voices the engine has for each language, once it has been asked. Kept across sessions: they belong to the device
 * rather than to the conversation, and asking again costs a bridge call per sentence.
 */
const voicesByLanguage = new Map<string, ITtsVoice[]>();

/**
 * How many times each voice has failed to say anything. See {@link VOICE_FAILURE_LIMIT}.
 */
const failures = new Map<string, number>();

/**
 * Hashes a speaker ID into the slot it would like.
 *
 * FNV-1a, for one property: every device in the room computes it, so a hash is what makes them agree on who sounds
 * like what without a word of it going over the wire. Nothing about it needs to be cryptographic.
 *
 * @param {string} speakerId - Who is being placed.
 * @returns {number}
 */
function hashSpeakerId(speakerId: string): number {
    let hash = 0x811c9dc5;

    for (let index = 0; index < speakerId.length; index++) {
        hash ^= speakerId.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

/**
 * Returns the slot a speaker is read out in, giving them one if this is the first thing they have said.
 *
 * Wanted slot first, then the next free one after it. The hash alone would be enough to keep a speaker sounding the
 * same for the whole session, but two speakers in a room of four can easily hash to the same slot, and hearing two
 * people in one voice is the thing this exists to stop. Probing costs the agreement between devices only in the rooms
 * where it actually fires.
 *
 * A speaker keeps their slot after they leave. Reusing it would hand a departed speaker's voice to the next person to
 * say something, which is worse than running an otherwise empty room out of slots.
 *
 * @param {string} speakerId - Who said something.
 * @returns {number}
 */
function slotFor(speakerId: string): number {
    const existing = slots.get(speakerId);

    if (existing !== undefined) {
        return existing;
    }

    const wanted = hashSpeakerId(speakerId) % VOICE_SLOT_COUNT;
    let slot = wanted;

    for (let offset = 0; offset < VOICE_SLOT_COUNT && takenSlots.has(slot); offset++) {
        slot = (wanted + offset + 1) % VOICE_SLOT_COUNT;
    }

    slots.set(speakerId, slot);
    takenSlots.add(slot);

    return slot;
}

/**
 * Orders the voices the engine has for a language, best first.
 *
 * Deliberately the order {@code applyBestVoice} scores them in on the Android side, so that the first slot is read in
 * the voice the engine would have used for everybody, and turning this on changes what a one-speaker room sounds like
 * not at all. Ties break on the name so that the order is the same for every sentence: a list which reordered itself
 * would move speakers between voices mid-conversation.
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
 * Returns the voices this device can read a language in, asking the engine the first time.
 *
 * An empty answer is not remembered. The engine is asked as the first sentence of a session is about to be read out,
 * which is early enough that it can still be warming up, and remembering that it had nothing then would leave the
 * whole session in one voice.
 *
 * @param {string} languageTag - A BCP-47 tag, as the engine takes it.
 * @returns {Promise<ITtsVoice[]>}
 */
async function voicesFor(languageTag: string): Promise<ITtsVoice[]> {
    const known = voicesByLanguage.get(languageTag);

    if (known) {
        return known;
    }

    const getVoices = getCaptionsTtsNativeModule()?.getVoices;

    if (!getVoices) {
        return [];
    }

    let voices: ITtsVoice[] = [];

    try {
        voices = orderVoices(await getVoices(languageTag) ?? [], languageTag);
    } catch (error) {
        logger.warn(`Could not ask the speech engine which voices it has for ${languageTag}`, error);

        return [];
    }

    if (!voices.length) {
        return [];
    }

    voicesByLanguage.set(languageTag, voices);
    logger.info(`The speech engine has ${voices.length} voice(s) for ${languageTag}`);

    return voices;
}

/**
 * Returns how a speaker is to be read out, in the language this listener is listening in.
 *
 * The slot is the speaker's for the session; which voice it comes to is worked out per language, because a device has
 * a different set of voices for each one. So a listener who changes language mid-session hears every speaker change
 * voice with them, and hears them stay as far apart from each other as they were.
 *
 * @param {string} speakerId - Who is about to be read out.
 * @param {string} languageTag - The language they are about to be read out in.
 * @returns {Promise<IS2SV2Voice>}
 */
export async function resolveVoiceForSpeaker(speakerId: string, languageTag: string): Promise<IS2SV2Voice> {
    const slot = slotFor(speakerId);
    const voices = await voicesFor(languageTag);

    if (!voices.length) {
        return { pitch: VOICE_PITCH_VARIANTS[slot % VOICE_PITCH_VARIANTS.length] };
    }

    const name = voices[slot % voices.length].name;
    const variant = Math.floor(slot / voices.length) % VOICE_PITCH_VARIANTS.length;
    const pitch = VOICE_PITCH_VARIANTS[variant];

    if ((failures.get(name) ?? 0) >= VOICE_FAILURE_LIMIT) {
        // Only this speaker moves off it. Dropping the voice from the list instead would renumber every slot after it
        // and change who sounds like what in the middle of the conversation.
        return { pitch };
    }

    return {
        name,
        pitch
    };
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
 * would only ask for the same list again.
 *
 * @returns {void}
 */
export function resetVoiceAssignments() {
    slots.clear();
    takenSlots.clear();
    failures.clear();
}
