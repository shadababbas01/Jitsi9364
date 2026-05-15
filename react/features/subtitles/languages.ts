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

export async function translateLiveCaptionText(
        text: string,
        targetLanguage?: string | null,
        authToken?: string | null): Promise<string> {
    const language = normalizeSubtitlesLanguage(targetLanguage)?.split(/[-_]/)[0];

    if (!text || !language || language.toLowerCase().startsWith('en')) {
        return text;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const body = new URLSearchParams({
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
