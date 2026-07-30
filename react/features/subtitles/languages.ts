import i18next from '../base/i18n/i18next';

export const LIVE_CAPTIONS_LANGUAGES_API_URL = 'https://static-ml.melp.us/languages/';
export const LIVE_CAPTIONS_TRANSLATION_API_URL = 'https://static-ml.melp.us/trans/';

const TRANSLATION_LANGUAGE_PREFIX = 'translation-languages:';

export interface ILiveCaptionsLanguage {
    code: string;
    label: string;
    value: string;
}

export function toSubtitlesLanguageValue(code: string) {
    return `${TRANSLATION_LANGUAGE_PREFIX}${code}`;
}

export function normalizeSubtitlesLanguage(language?: string | null) {
    return language?.replace(TRANSLATION_LANGUAGE_PREFIX, '') ?? null;
}

/**
 * Reduces a language code to its base language, so that 'en-GB', 'en_US' and 'en' all compare equal.
 *
 * @param {string} language - A language code, with or without a region.
 * @returns {string}
 */
export function toBaseSubtitlesLanguage(language?: string | null) {
    return normalizeSubtitlesLanguage(language)?.split(/[-_]/)[0].toLowerCase() ?? '';
}

/**
 * Decides whether a subtitle has to be translated client side before being displayed or spoken, and returns the
 * language to translate it into. Shared by the caption UI and the caption text-to-speech feature so that what is read
 * aloud is exactly what is on screen.
 *
 * @param {Object} subtitle - The relevant parts of the received subtitle.
 * @param {string} targetLanguage - The language the local user selected for the captions.
 * @returns {string | null} - The language to translate into, or null when the text can be used as is.
 */
export function getSubtitleTranslationTarget({ interim, language, text }: {
    interim?: boolean;
    isTranscription?: boolean;
    language?: string | null;
    text?: string;
}, targetLanguage?: string | null): string | null {
    const target = normalizeSubtitlesLanguage(targetLanguage);

    // A caption already in the wanted language needs no translation. Comparing the base languages keeps 'en-US' speech
    // out of an 'en' translation, while still translating, say, Spanish speech into English.
    if (interim || !text || !target || toBaseSubtitlesLanguage(language) === toBaseSubtitlesLanguage(target)) {
        return null;
    }

    return target;
}

/**
 * Caps the size of {@link translationCache} so a long meeting cannot grow it without bounds.
 */
const TRANSLATION_CACHE_LIMIT = 500;

/**
 * Translations already fetched, mapped by message ID and target language.
 */
const translationCache = new Map<string, Promise<string>>();

/**
 * Translates a subtitle, reusing an in-flight or previous request for the same message and target language. Lets the
 * captions UI and the caption text-to-speech feature share a single network request per message.
 *
 * @param {string} cacheKey - Identifies the message, usually its message ID.
 * @param {string} text - The text to translate.
 * @param {string} targetLanguage - The language to translate into.
 * @param {string} authToken - The JWT to authenticate the request with.
 * @returns {Promise<string>}
 */
export function translateLiveCaptionTextCached(
        cacheKey: string,
        text: string,
        targetLanguage?: string | null,
        authToken?: string | null): Promise<string> {
    const key = `${cacheKey}:${normalizeSubtitlesLanguage(targetLanguage)}`;
    const cached = translationCache.get(key);

    if (cached) {
        return cached;
    }

    const request = translateLiveCaptionText(text, targetLanguage, authToken)
        .catch(error => {
            // Do not cache failures, the next caller should be able to retry.
            translationCache.delete(key);

            throw error;
        });

    if (translationCache.size >= TRANSLATION_CACHE_LIMIT) {
        const oldestKey = translationCache.keys().next().value;

        if (oldestKey) {
            translationCache.delete(oldestKey);
        }
    }

    translationCache.set(key, request);

    return request;
}

export async function translateLiveCaptionText(
        text: string,
        targetLanguage?: string | null,
        authToken?: string | null): Promise<string> {
    const language = toBaseSubtitlesLanguage(targetLanguage);

    if (!text || !language) {
        return text;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const body = new URLSearchParams({
        // Left empty on purpose: the service detects the spoken language itself, and it is more reliable at it than
        // whatever language the local user says they are speaking.
        slg: '',
        stxt: text,
        tlg: language
    }).toString();

    const response = await fetch(LIVE_CAPTIONS_TRANSLATION_API_URL, {
        body,
        headers,
        method: 'POST'
    });

    if (!response.ok) {
        throw new Error(`Caption translation failed with ${response.status}`);
    }

    const data = await response.json();

    return data?.tgt_txt || text;
}

export async function fetchLiveCaptionsLanguages(fallbackCodes: string[] = []): Promise<ILiveCaptionsLanguage[]> {
    try {
        const response = await fetch(`${LIVE_CAPTIONS_LANGUAGES_API_URL}?v=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`Languages request failed with ${response.status}`);
        }

        const data: Record<string, string> = await response.json();
        const codes = Array.from(new Set([ 'en', ...Object.keys(data) ]));

        return codes.map(code => ({
            code,
            label: data[code] || i18next.t(toSubtitlesLanguageValue(code)),
            value: toSubtitlesLanguageValue(code)
        }));
    } catch (_) {
        const codes = Array.from(new Set([ 'en', ...fallbackCodes ]));

        return codes.map(code => ({
            code,
            label: i18next.t(toSubtitlesLanguageValue(code)),
            value: toSubtitlesLanguageValue(code)
        }));
    }
}
