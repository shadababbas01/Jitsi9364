import { IJitsiConference } from '../base/conference/reducer';

export interface IPersistedSummaryState {
    enabled: boolean;
    category: string | null;
    timestamp: number;
}

const SUMMARY_STATE_STORAGE_PREFIX = 'melp.summary-state';
const SUMMARY_STATE_STORAGE_TTL = 1000 * 60 * 60 * 6; // 6 hours

const getStorage = () => {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        return window.localStorage ?? window.sessionStorage;
    } catch (e) {
        return undefined;
    }
};

type JitsiConfWithRoomJid = IJitsiConference & {
    room?: { jid?: string };
};

const getConferenceIdentifier = (conference?: JitsiConfWithRoomJid) => {
    if (!conference) {
        return undefined;
    }

    const fromGetter = conference.getName?.();
    if (fromGetter) {
        return fromGetter;
    }

    if (typeof conference.room?.jid === 'string') {
        return conference.room.jid;
    }

    return conference.options?.name;
};


const getStorageKey = (conference?: IJitsiConference) => {
    const identifier = getConferenceIdentifier(conference);

    return identifier ? `${SUMMARY_STATE_STORAGE_PREFIX}:${identifier}` : undefined;
};

export const readPersistedSummaryState = (conference?: IJitsiConference): IPersistedSummaryState | undefined => {
    const storage = getStorage();
    const key = getStorageKey(conference);

    if (!storage || !key) {
        return undefined;
    }

    const raw = storage.getItem(key);

    if (!raw) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed.enabled === 'undefined') {
            storage.removeItem(key);

            return undefined;
        }

        if (typeof parsed.timestamp !== 'number'
                || (Date.now() - parsed.timestamp) > SUMMARY_STATE_STORAGE_TTL) {
            storage.removeItem(key);

            return undefined;
        }

        return {
            enabled: Boolean(parsed.enabled),
            category: typeof parsed.category === 'string' ? parsed.category : null,
            timestamp: parsed.timestamp
        };
    } catch (e) {
        storage.removeItem(key);

        return undefined;
    }
};

export const persistSummaryState = (
        conference: IJitsiConference | undefined,
        state?: { enabled: boolean; category?: string | null; }) => {
    const storage = getStorage();
    const key = getStorageKey(conference);

    if (!storage || !key) {
        return;
    }

    if (!state || !state.enabled) {
        storage.removeItem(key);

        return;
    }

    try {
        storage.setItem(key, JSON.stringify({
            enabled: Boolean(state.enabled),
            category: typeof state.category === 'string' ? state.category : null,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Ignore storage quota issues.
    }
};