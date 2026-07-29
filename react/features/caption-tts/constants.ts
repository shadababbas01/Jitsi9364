/**
 * The maximum number of utterances kept in the speech queue. Captions arrive faster than they can be spoken, so once
 * the queue is full the oldest pending utterance is dropped. Speaking a backlog would drift further and further behind
 * the live conversation, which is worse than skipping a line.
 */
export const MAX_QUEUE_LENGTH = 3;

/**
 * The default speech rate, where 1 is the engine's own default rate.
 */
export const DEFAULT_SPEECH_RATE = 1;

/**
 * The maximum number of message IDs remembered in order to never speak the same caption twice.
 */
export const SPOKEN_CACHE_LIMIT = 500;

/**
 * How long a message ID is remembered in the spoken cache.
 */
export const SPOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * The language spoken when a caption carries no usable language of its own.
 */
export const FALLBACK_LANGUAGE_TAG = 'en-US';

/**
 * Bare language codes which need a region in order for the device engine to find a voice for them.
 */
export const LANGUAGE_TAG_OVERRIDES: { [key: string]: string; } = {
    ar: 'ar-EG',
    bn: 'bn-IN',
    cs: 'cs-CZ',
    da: 'da-DK',
    el: 'el-GR',
    en: 'en-US',
    fa: 'fa-IR',
    he: 'iw-IL',
    hi: 'hi-IN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    nb: 'nb-NO',
    pt: 'pt-BR',
    sv: 'sv-SE',
    ta: 'ta-IN',
    te: 'te-IN',
    uk: 'uk-UA',
    ur: 'ur-PK',
    vi: 'vi-VN',
    zh: 'zh-CN'
};
