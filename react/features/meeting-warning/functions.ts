export const DEFAULT_UPGRADE_PLANS_URL = 'https://pay.app.melpapp.com/spa/paymentPage#payment';

type IMeetingLimitPayload = {
    ended?: boolean;
    message: string;
    title?: string;
    warning?: boolean;
};

const MEETING_LIMIT_REASON_PATTERNS = [
    'call time',
    'cap',
    'capping',
    'duration limit',
    'maximum call duration',
    'meeting limit',
    'limit reached',
    'quota',
    'time limit',
    'upgrade your plan'
];

export function resolveUpgradePlansUrl(upgradePlansUrl?: string) {
    const normalizedUrl = typeof upgradePlansUrl === 'string' ? upgradePlansUrl.trim() : '';

    return normalizedUrl || DEFAULT_UPGRADE_PLANS_URL;
}

export function getMeetingLimitDialogPropsFromError(error: any) {
    const rawValues = [
        error?.message,
        ...(Array.isArray(error?.params) ? error.params : [])
    ];

    for (const rawValue of rawValues) {
        const payload = toMeetingLimitPayload(rawValue);

        if (payload) {
            return {
                message: payload.message,
                title: payload.title || (payload.ended ? 'Meeting ended' : 'Meeting ending soon')
            };
        }
    }

    const reasonText = rawValues
        .map(_stringifyReason)
        .filter(Boolean)
        .join(' ');
    const normalizedReason = reasonText.toLowerCase();

    if (!normalizedReason || !MEETING_LIMIT_REASON_PATTERNS.some(pattern => normalizedReason.includes(pattern))) {
        return;
    }

    return {
        message: 'Your call time limit has been reached. Upgrade your plan to continue.',
        title: 'Meeting ended'
    };
}

function toMeetingLimitPayload(rawValue: unknown): IMeetingLimitPayload | undefined {
    const parsedValue = _parseMaybeJSON(rawValue);

    if (!parsedValue || typeof parsedValue !== 'object' || typeof parsedValue.message !== 'string') {
        return;
    }

    if (!parsedValue.warning && !parsedValue.ended && typeof parsedValue.title !== 'string') {
        return;
    }

    return {
        ended: Boolean(parsedValue.ended),
        message: parsedValue.message,
        title: typeof parsedValue.title === 'string' ? parsedValue.title : undefined,
        warning: Boolean(parsedValue.warning)
    };
}

function _parseMaybeJSON(rawValue: unknown) {
    if (typeof rawValue !== 'string') {
        return rawValue;
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        return rawValue;
    }
}

function _stringifyReason(rawValue: unknown) {
    if (typeof rawValue === 'string') {
        return rawValue;
    }

    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        return String(rawValue);
    }

    if (rawValue && typeof rawValue === 'object') {
        const { message, reason, title } = rawValue as Record<string, unknown>;

        return [ message, reason, title ]
            .filter(value => typeof value === 'string')
            .join(' ');
    }

    return '';
}
