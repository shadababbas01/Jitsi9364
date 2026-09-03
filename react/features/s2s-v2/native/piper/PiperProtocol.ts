/**
 * The prefix a caller may still have on a language value handed down from an older part of the app. Stripped before
 * anything is compared, so a caller which has not been updated to send a bare code is not treated as asking for a
 * language which does not exist.
 */
const TRANSLATION_LANGUAGES_PREFIX = 'translation-languages:';

/**
 * The characters a base64 payload may be made of, padding included.
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * One voice the speech service is willing to speak in.
 */
export interface IPiperVoice {

    /**
     * What to show a person choosing it. Falls back to {@link id} when the service names a voice by id alone.
     */
    displayName: string;

    /**
     * The value this device has to send back to ask for this voice.
     */
    id: string;
}

/**
 * One entry in the shape the service actually sends a voice in: an id and a label to show for it. Melp's Piper
 * service calls the label "placeholder"; "displayName" is accepted too in case a differently configured deployment
 * names it that instead.
 */
interface IRawVoiceEntry {
    displayName?: unknown;
    id?: unknown;
    placeholder?: unknown;
}

/**
 * One request this device has sent, waiting to be turned into speech.
 */
export interface ISynthesizeMessage {
    language: string;
    text: string;
    type: 'synthesize';
}

/**
 * Audio the speech service has already turned a sentence into.
 */
export interface IDecodedAudio {
    bytes: string;
    format: string;
}

/**
 * Removes the prefix an older caller may still put in front of a language, and lowercases what is left so that two
 * spellings of the same language compare equal.
 *
 * @param {string} value - What a caller asked for.
 * @returns {string}
 */
function normalizeRequestedLanguage(value: string): string {
    const withoutPrefix = value.startsWith(TRANSLATION_LANGUAGES_PREFIX)
        ? value.slice(TRANSLATION_LANGUAGES_PREFIX.length)
        : value;

    // The service accepts both "en_US" and "en-US" and treats them the same, normalizing "-" to "_" on its own side -
    // matched here so that a request built from a dash-separated locale still compares equal to the underscored id
    // the service actually advertises.
    return withoutPrefix.trim().toLowerCase().replace(/-/g, '_');
}

/**
 * The part of a language id before its first separator, which is what two regional voices of the same language have
 * in common - "pt_BR" and "pt_PT" are both "pt".
 *
 * @param {string} id - A language or voice id.
 * @returns {string}
 */
function baseLanguage(id: string): string {
    return id.split(/[-_]/)[0].toLowerCase();
}

/**
 * Finds the voice among those the service has advertised which best answers a requested language, preferring an
 * exact id over one which only shares a base language, and answering nothing rather than guessing when neither is
 * there.
 *
 * @param {string} requested - The language a caller asked for.
 * @param {Array<IPiperVoice>} advertised - What the service has said it can speak.
 * @returns {IPiperVoice | undefined}
 */
function findAdvertisedVoice(requested: string, advertised: IPiperVoice[]): IPiperVoice | undefined {
    const normalized = normalizeRequestedLanguage(requested);

    const exact = advertised.find(voice => voice.id.toLowerCase() === normalized);

    if (exact) {
        return exact;
    }

    const wanted = baseLanguage(normalized);

    return advertised.find(voice => baseLanguage(voice.id) === wanted);
}

/**
 * Turns whatever shape the speech service has sent its voice list in into one this device can search and show.
 *
 * Melp's Piper service sends the list keyed by an arbitrary numeric index rather than as an array - `{"0": {...},
 * "1": {...}}` - so both an object and an array are accepted here, read the same way once each entry has been
 * pulled out of it. Each entry may be a bare string or an object carrying an id and a label; a differently
 * configured deployment has been seen to name the whole message "voices" instead of "languages" and to call the
 * label "displayName" instead of "placeholder", so both names are accepted for each rather than assuming there is
 * only one shape this ever arrives in. An entry which is none of these, or which has no usable id, is left out
 * rather than allowed to reach a caller as a voice nothing can actually be asked for.
 *
 * @param {unknown} message - What arrived over the connection.
 * @returns {Array<IPiperVoice>}
 */
export function normalizeVoiceList(message: unknown): IPiperVoice[] {
    if (!message || typeof message !== 'object') {
        return [];
    }

    const raw = (message as { languages?: unknown; voices?: unknown; }).languages
        ?? (message as { languages?: unknown; voices?: unknown; }).voices;

    let entries: unknown[];

    if (Array.isArray(raw)) {
        entries = raw;
    } else if (raw && typeof raw === 'object') {
        entries = Object.values(raw);
    } else {
        return [];
    }

    const byId = new Map<string, IPiperVoice>();

    for (const entry of entries) {
        let id: unknown;
        let displayName: unknown;

        if (typeof entry === 'string') {
            id = entry;
            displayName = entry;
        } else if (entry && typeof entry === 'object') {
            const rawEntry = entry as IRawVoiceEntry;

            id = rawEntry.id;
            displayName = rawEntry.placeholder ?? rawEntry.displayName;
        } else {
            continue;
        }

        if (typeof id !== 'string' || !id.trim()) {
            continue;
        }

        const key = id.toLowerCase();

        if (byId.has(key)) {
            continue;
        }

        byId.set(key, {
            displayName: typeof displayName === 'string' && displayName.trim() ? displayName : id,
            id
        });
    }

    return [ ...byId.values() ].sort(
        (first, second) => (first.displayName || first.id).localeCompare(second.displayName || second.id));
}

/**
 * Picks the full voice id to ask the speech service for, given a language a caller wants and the voices the service
 * has said it can speak.
 *
 * Resolved in the order the service is allowed to be asked in: the exact id first, then a voice which shares the
 * same base language, and only once neither exists does this fall back to whatever the caller asked for - which the
 * service may or may not recognise, but is the best a device with no better information can offer it.
 *
 * @param {string} requested - The language a caller asked for.
 * @param {Array<IPiperVoice>} advertised - What the service has said it can speak.
 * @returns {string}
 */
export function resolveVoiceId(requested: string, advertised: IPiperVoice[]): string {
    return findAdvertisedVoice(requested, advertised)?.id ?? normalizeRequestedLanguage(requested);
}

/**
 * Returns whether the service has advertised a voice for a language, without falling back to guessing one.
 *
 * Kept separate from {@link resolveVoiceId}, which always answers something: a caller asking whether a language can
 * be spoken at all needs to be told no when it cannot, not handed back its own guess as though it were an answer.
 *
 * @param {string} requested - The language in question.
 * @param {Array<IPiperVoice>} advertised - What the service has said it can speak.
 * @returns {boolean}
 */
export function hasAdvertisedVoice(requested: string, advertised: IPiperVoice[]): boolean {
    return Boolean(findAdvertisedVoice(requested, advertised));
}

/**
 * Builds the one message this protocol ever sends, or answers nothing for text which is not worth sending.
 *
 * @param {string} text - What to speak.
 * @param {string} voiceId - The full voice id resolved for it.
 * @returns {ISynthesizeMessage | null}
 */
export function buildSynthesizeMessage(text: string, voiceId: string): ISynthesizeMessage | null {
    const trimmed = text.trim();

    if (!trimmed) {
        return null;
    }

    return {
        language: voiceId,
        text: trimmed,
        type: 'synthesize'
    };
}

/**
 * Decodes an audio reply, or answers nothing for one which cannot be played.
 *
 * A data URL prefix is stripped when the service has included one. Missing, non-string, or non-base64 payloads are
 * rejected here rather than handed to a player which would have to discover the same thing by failing to decode it.
 *
 * @param {Object} message - The reply's own fields, already known to be an "audio" message.
 * @returns {IDecodedAudio | null}
 */
export function decodeAudioPayload(message: { data?: unknown; format?: unknown; }): IDecodedAudio | null {
    if (typeof message.data !== 'string') {
        return null;
    }

    const commaIndex = message.data.indexOf(',');
    const stripped = message.data.startsWith('data:') && commaIndex >= 0
        ? message.data.slice(commaIndex + 1)
        : message.data;

    const trimmed = stripped.trim();

    if (!trimmed || trimmed.length % 4 !== 0 || !BASE64_PATTERN.test(trimmed)) {
        return null;
    }

    return {
        bytes: trimmed,
        format: typeof message.format === 'string' && message.format ? message.format : 'wav'
    };
}
