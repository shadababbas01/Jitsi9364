import i18next from '../base/i18n/i18next';
import { LIVE_CAPTIONS_LANGUAGES_API_URL } from '../subtitles/languages';

export interface IVoiceTranslationLanguage {
    code: string;
    name: string;
}

export const FALLBACK_VOICE_TRANSLATION_LANGUAGES: IVoiceTranslationLanguage[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'hi', name: 'Hindi' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }
];

/**
 * Fetches API-backed languages for voice translation selectors.
 *
 * @returns {Promise<IVoiceTranslationLanguage[]>}
 */
export async function fetchVoiceTranslationLanguages(): Promise<IVoiceTranslationLanguage[]> {
    try {
        const response = await fetch(`${LIVE_CAPTIONS_LANGUAGES_API_URL}?v=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`Languages request failed with ${response.status}`);
        }

        const data: Record<string, string> = await response.json();

        return Object.keys(data)
            .map(code => ({
                code,
                name: data[code] || i18next.t(`translation-languages:${code}`)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (_) {
        return FALLBACK_VOICE_TRANSLATION_LANGUAGES;
    }
}

/**
 * Returns the primary language code.
 *
 * @param {string} language - Language code.
 * @returns {string}
 */
export function toBaseVoiceLanguage(language?: string | null) {
    return (language || '').replace(/^translation-languages:/, '').split(/[-_]/)[0];
}

/**
 * Returns a readable language name for a voice translation language code.
 *
 * @param {string} language - Language code.
 * @returns {string}
 */
export function getVoiceLanguageDisplayName(language?: string | null) {
    const baseLanguage = toBaseVoiceLanguage(language);

    if (!baseLanguage) {
        return '';
    }

    const fallbackLanguage = FALLBACK_VOICE_TRANSLATION_LANGUAGES.find(item => item.code === baseLanguage);

    if (fallbackLanguage) {
        return fallbackLanguage.name;
    }

    const translationKey = `translation-languages:${baseLanguage}`;
    const translatedLanguage = i18next.t(translationKey);

    return translatedLanguage === translationKey ? baseLanguage.toUpperCase() : translatedLanguage;
}
