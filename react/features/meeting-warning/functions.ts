import { IReduxState } from '../app/types';
import i18next from '../base/i18n/i18next';
import { INCREMENT_FEATURE_USAGE } from '../base/jwt/actionTypes';
import { JwtAccessFeature, isJwtAccessFeatureBlocked } from '../base/jwt/functions';
import { IFeatureUsageLimit } from '../base/jwt/reducer';
import { showMeetingLimitDialog } from '../chat/actions.any';

/**
 * The features whose usage is tracked against a JWT-provided quota.
 * Must stay in sync with TRACKED_FEATURE_USAGE_KEYS in base/jwt/middleware.ts.
 */
export type TrackedFeature =
    | 'ask_ai'
    | 'evaluationmode'
    | 'polls'
    | 'recording'
    | 'summary'
    | 'transcription'
    | 'speech_to_speech'
    | 'evaluation_questions';

// Features counted per-meeting by prosody — local counter is never incremented.
export const NO_LOCAL_INCREMENT = new Set<TrackedFeature>([
    'ask_ai', 'speech_to_speech'
]);

export const FEATURE_LABEL: Record<TrackedFeature, string> = {
    ask_ai: 'Ask AI',
    evaluationmode: 'Evaluation mode',
    polls: 'Polls',
    recording: 'Recording',
    summary: 'AI summary',
    transcription: 'Transcription',
    speech_to_speech: 'Real-time translation',
    evaluation_questions: 'AI interview questions'
};

/**
 * Localized label of a tracked feature (lang/main.json meetingLimit.features), English fallback.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @returns {string}
 */
export function featureLabel(feature: TrackedFeature): string {
    return i18next.t(`meetingLimit.features.${feature}`, { defaultValue: FEATURE_LABEL[feature] });
}

/**
 * Coerces an arbitrary value into a non-negative integer.
 *
 * @param {unknown} value - The raw value.
 * @returns {number}
 */
export function toPositiveInt(value: unknown) {
    const n = Number(value);

    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Reads the JWT-provided usage limit for a tracked feature.
 *
 * @param {any} state - The redux state.
 * @param {TrackedFeature} feature - The feature key.
 * @returns {IFeatureUsageLimit | undefined}
 */
export function getFeatureLimit(state: any, feature: TrackedFeature): IFeatureUsageLimit | undefined {
    return state?.['features/base/jwt']?.featureUsageLimits?.[feature];
}

/**
 * Builds the soft-alert dialog action shown when a feature is near/at its limit.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @param {number} used - The used count to display.
 * @param {number} limit - The limit to display.
 * @returns {Object}
 */
export function softAlertDialog(feature: TrackedFeature, used: number, limit: number) {
    const label = featureLabel(feature);

    return showMeetingLimitDialog({
        title: i18next.t('meetingLimit.softTitle', { feature: label, defaultValue: `${label} limit warning` }),
        message: i18next.t('meetingLimit.softMessage', {
            feature: label, used, limit,
            defaultValue: `You have used ${used}/${limit} of your ${label} quota. Upgrade to avoid interruption.`
        })
    });
}

/**
 * Builds the hard-limit dialog action shown when a feature's quota is exhausted.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @param {number} limit - The limit that was reached.
 * @returns {Object}
 */
export function hardLimitDialog(feature: TrackedFeature, limit: number) {
    const label = featureLabel(feature);

    return showMeetingLimitDialog({
        title: i18next.t('meetingLimit.hardTitle', { feature: label, defaultValue: `${label} limit reached` }),
        message: i18next.t('meetingLimit.hardMessage', {
            feature: label, limit,
            defaultValue: `You have reached your ${label} limit (${limit}). Upgrade your plan to continue.`
        })
    });
}

/**
 * Builds the "not available in your plan" dialog action.
 *
 * @param {string} label - The human-readable feature label.
 * @param {boolean} plural - Whether the label is a plural noun ("Breakout rooms are ...").
 * @returns {Object}
 */
export function featureBlockedDialog(label: string, plural = false) {
    const verb = plural ? 'are' : 'is';

    return showMeetingLimitDialog({
        title: i18next.t('meetingLimit.blockedTitle', { feature: label, defaultValue: `${label} unavailable` }),
        message: i18next.t(plural ? 'meetingLimit.blockedMessagePlural' : 'meetingLimit.blockedMessage', {
            feature: label,
            defaultValue: `${label} ${verb} not available in your current plan. Upgrade to continue.`
        })
    });
}

const BLOCKED_FEATURE_LABEL: Record<JwtAccessFeature, string> = {
    'ask_ai': 'Ask AI',
    breakoutrooms: 'Breakout rooms',
    evaluationmode: 'Evaluation mode',
    'melp_pad': 'Melp Pad',
    noisesupression: 'Noise suppression',
    webinar: 'Webinar',
    whiteboard: 'Whiteboard'
};

/**
 * Plan-gated features whose label is a plural noun.
 */
const PLURAL_BLOCKED_FEATURES = new Set<JwtAccessFeature>([ 'breakoutrooms' ]);

/**
 * Localized label of a plan-gated (on/off) feature, English fallback.
 *
 * @param {JwtAccessFeature} feature - The feature key.
 * @returns {string}
 */
export function blockedFeatureLabel(feature: JwtAccessFeature): string {
    return i18next.t(`meetingLimit.features.${feature}`, { defaultValue: BLOCKED_FEATURE_LABEL[feature] });
}

/**
 * Gate for a plan-gated (on/off) feature. Returns true when the plan includes it; otherwise shows the "not available
 * in your plan" dialog and returns false.
 *
 * @param {JwtAccessFeature} feature - The feature key.
 * @returns {Function} A redux thunk resolving to a boolean.
 */
export const checkFeatureAccess = (feature: JwtAccessFeature) =>
    (dispatch: Function, getState: Function): boolean => {
        if (!isJwtAccessFeatureBlocked(getState(), feature)) {
            return true;
        }

        dispatch(featureBlockedDialog(blockedFeatureLabel(feature), PLURAL_BLOCKED_FEATURES.has(feature)));

        return false;
    };

/**
 * Where a quota stands before one more use.
 */
export type QuotaStatus = 'ok' | 'exhausted' | 'unavailable';

/**
 * Classifies a quota before one more use. A positive limit that is used up is "exhausted". A zero limit the issuer
 * marked disabled is how a plan without the feature is encoded, so it is "unavailable". Anything else, including a
 * zero limit that is still enabled, is not capped here.
 *
 * @param {IFeatureUsageLimit} featureLimit - The quota.
 * @returns {QuotaStatus}
 */
export function getQuotaStatus(featureLimit: IFeatureUsageLimit): QuotaStatus {
    const used = toPositiveInt(featureLimit.used);
    const limit = toPositiveInt(featureLimit.limit);

    if (limit > 0 && used >= limit) {
        return 'exhausted';
    }

    if (limit === 0 && featureLimit.enabled === false) {
        return 'unavailable';
    }

    return 'ok';
}

/**
 * Pre-action gate for component-level features (those without a dedicated redux
 * action that the meeting-warning middleware can intercept). Returns true when
 * the feature may be used; otherwise shows the appropriate blocking dialog and
 * returns false. Does not mutate usage — call {@link commitFeatureUsage} after
 * the feature has actually been used.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @returns {Function} A redux thunk resolving to a boolean.
 */
export const checkFeatureUsage = (feature: TrackedFeature) =>
    (dispatch: Function, getState: Function): boolean => {
        const featureLimit = getFeatureLimit(getState(), feature);

        if (!featureLimit) {
            // No quota configured for this feature — allow.
            return true;
        }

        switch (getQuotaStatus(featureLimit)) {
        case 'exhausted':
            dispatch(hardLimitDialog(feature, toPositiveInt(featureLimit.limit)));

            return false;
        case 'unavailable':
            dispatch(featureBlockedDialog(featureLabel(feature)));

            return false;
        }

        return true;
    };

/**
 * Soft alert for a use that takes the count from `used` to `used + 1`: shown at the last unit
 * before the limit, or once the alert threshold is passed. Both branches show the count *after*
 * this use (`used + 1`).
 *
 * @param {TrackedFeature} feature - The feature key.
 * @param {number} used - The count before this use.
 * @param {number} limit - The limit.
 * @param {number} alertlimit - The soft-alert threshold.
 * @param {boolean} showPostLimitAlert - Whether the last-unit alert applies.
 * @returns {Function} A redux thunk.
 */
export const softAlertForUse = (
        feature: TrackedFeature, used: number, limit: number, alertlimit: number, showPostLimitAlert = true) =>
    (dispatch: Function): boolean => {
        if (showPostLimitAlert && limit > 0 && used >= limit - 1) {
            dispatch(softAlertDialog(feature, used + 1, limit));

            return true;
        }
        if (alertlimit > 0 && used >= alertlimit) {
            dispatch(softAlertDialog(feature, used + 1, limit > 0 ? limit : used + 1));

            return true;
        }

        return false;
    };

/**
 * Post-action commit for component-level features. Call after the feature was
 * actually used successfully. Increments the local usage counter and shows a
 * soft alert when near/at the limit.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @param {Object} [options] - Options.
 * @param {boolean} [options.showPostLimitAlert=true] - Whether to show the soft alert.
 * @returns {Function} A redux thunk.
 */
export const commitFeatureUsage = (feature: TrackedFeature, { showPostLimitAlert = true } = {}) =>
    (dispatch: Function, getState: Function): void => {
        const featureLimit = getFeatureLimit(getState(), feature);

        if (!featureLimit) {
            return;
        }

        const used = toPositiveInt(featureLimit.used);
        const limit = toPositiveInt(featureLimit.limit);
        const alertlimit = toPositiveInt(featureLimit.alertlimit);

        dispatch({ type: INCREMENT_FEATURE_USAGE, feature });
        dispatch(softAlertForUse(feature, used, limit, alertlimit, showPostLimitAlert));
    };

/**
 * Soft alert for a feature counted by the server (NO_LOCAL_INCREMENT: once per meeting), raised
 * after it was used successfully. Nothing is counted locally.
 *
 * @param {TrackedFeature} feature - The feature key.
 * @returns {Function} A redux thunk resolving to true when the soft alert was shown.
 */
export const alertServerCountedUsage = (feature: TrackedFeature) =>
    (dispatch: Function, getState: Function): boolean => {
        const featureLimit = getFeatureLimit(getState(), feature);

        if (!featureLimit) {
            return false;
        }

        return dispatch(softAlertForUse(feature, toPositiveInt(featureLimit.used), toPositiveInt(featureLimit.limit),
            toPositiveInt(featureLimit.alertlimit)));
    };

/**
 * Detects the server's meeting warning/ended signal in a conference message. The server sends it in different shapes
 * depending on the room type: explicit flags, a component or type name, a title and message, or plain text.
 *
 * @param {string} rawMessage - The received message.
 * @returns {Object}
 */
export function detectMeetingSignal(rawMessage: string): { ended: boolean; parsedMessage: string; warning: boolean; } {
    const extra = parseJsonMessage(rawMessage);
    let warning = Boolean(extra?.warning);
    let ended = Boolean(extra?.ended);

    // { component: "meeting-ending", message: "..." }
    if (!warning && !ended && typeof extra?.component === 'string') {
        warning = extra.component.toLowerCase().includes('meeting-ending');
    }

    // { type: "meeting-warning" } or { type: "meeting-ended" }
    if (!warning && !ended && typeof extra?.type === 'string') {
        const type = extra.type.toLowerCase();

        // "meeting-ending" is the warning, not the end.
        ended = type.includes('meeting') && type.includes('end') && !type.includes('ending');
        warning = !ended && type.includes('meeting') && (type.includes('warning') || type.includes('ending'));
    }

    // { title: "Meeting ending soon", message: "..." }
    if (!warning && !ended && extra?.title && extra?.message) {
        const title = String(extra.title).toLowerCase();

        ended = title.includes('ended');
        warning = !ended && (title.includes('meeting') || Boolean(extra.imageurl));
    }

    // Plain text, e.g. "This session will end in 2 minutes."
    if (!warning && !ended && extra === null) {
        const lower = rawMessage.toLowerCase();

        ended = lower.includes('session ended') || lower.includes('meeting ended');
        warning = !ended && (
            lower.includes('will end in')
            || lower.includes('session will end')
            || lower.includes('meeting will end')
            || lower.includes('meeting ending')
        );
    }

    let parsedMessage = rawMessage;

    if (typeof extra?.message === 'string') {
        parsedMessage = extra.message;
    } else if (typeof extra?.text === 'string') {
        parsedMessage = extra.text;
    }

    return {
        ended,
        parsedMessage,
        warning
    };
}

/**
 * The capping popup for a meeting warning/ended signal.
 *
 * @param {string} message - The server's message.
 * @param {boolean} ended - Whether the meeting has ended.
 * @returns {Object}
 */
export function meetingSignalDialog(message: string, ended: boolean) {
    return ended
        ? {
            ended: true,
            message,
            title: i18next.t('meetingLimit.endedTitle', { defaultValue: 'Meeting ended' })
        }
        : {
            ended: false,
            message,
            title: i18next.t('meetingLimit.defaultTitle', { defaultValue: 'Meeting ending soon' })
        };
}

/**
 * Parses a chat message body as json, the way the server's time-limit messages may be encoded.
 *
 * @param {string} message - The message body.
 * @returns {any} The parsed object, or null when the body is not a json object.
 */
export function parseJsonMessage(message: string): any {
    try {
        const parsed = JSON.parse(message);

        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Prosody announces the plan duration as a plain chat message when the meeting starts. Meeting limits use the
 * capping popup instead, so the announcement is kept out of chat.
 */
const CALL_LIMIT_SYSTEM_MESSAGE_REGEX = /^This call is limited to \d+(?:\.\d+)? minutes?\.?$/i;

/**
 * Whether a received chat message is the server's plan-duration announcement.
 *
 * @param {string} message - The message body.
 * @returns {boolean}
 */
export function isCallLimitAnnouncement(message: string) {
    return typeof message === 'string' && CALL_LIMIT_SYSTEM_MESSAGE_REGEX.test(message.trim());
}

/**
 * Takes a received conference message that is not chat: the server's time-limit warning or end (shown as the capping
 * popup), its plan-duration announcement, or web's usage telemetry.
 *
 * @param {string} message - The message body.
 * @param {boolean} fromServer - The message came from the room itself rather than from a participant. Plain text is
 * only read as a signal then: anyone can type "the meeting will end in 5 minutes" into the chat.
 * @param {boolean} fromHistory - The message is room history replayed on join: a signal in it is stale and is
 * dropped without a popup.
 * @returns {Function} A redux thunk resolving to true when the message must not reach the chat.
 */
export const consumeServerChatMessage = (message: string, fromServer: boolean, fromHistory: boolean) =>
    (dispatch: Function): boolean => {
        if (typeof message !== 'string') {
            return false;
        }

        const extra = parseJsonMessage(message);

        if (extra || fromServer) {
            const { ended, parsedMessage, warning } = detectMeetingSignal(message);

            if (warning || ended) {
                fromHistory || dispatch(showMeetingLimitDialog(meetingSignalDialog(parsedMessage, ended)));

                return true;
            }
        }

        return isCallLimitAnnouncement(message) || extra?.type === 'melp-usage';
    };

/**
 * Whether the capping popup on screen is the "Meeting ended" one.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isMeetingEndedDialogOpen(state: IReduxState) {
    const { meetingLimitDialog } = state['features/chat'];

    return Boolean(meetingLimitDialog?.open && meetingLimitDialog.ended);
}
