/* eslint-disable @typescript-eslint/no-var-requires */

// lodash-es ships ES modules, which this jest setup does not transform.
jest.mock('lodash-es', () => require('lodash'));

// The logger picks a platform-specific transport, which this node-only setup cannot resolve.
jest.mock('../../base/logging/functions', () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn(), log: jest.fn(), warn: jest.fn() };

    return { getLogger: () => logger };
});

// Copy is resolved by i18next in the app; the English fallbacks are enough to tell the popups apart here.
jest.mock('../../base/i18n/i18next', () => {
    return {
        __esModule: true,
        default: { t: (_key: string, options: { defaultValue?: string; } = {}) => options.defaultValue }
    };
});

const mockRegistered: { middleware?: Function; reducers: Record<string, Function>; } = { reducers: {} };

jest.mock('../../base/redux/MiddlewareRegistry', () => {
    return {
        __esModule: true,
        default: { register: (middleware: Function) => {
            mockRegistered.middleware = middleware;
        } }
    };
});
jest.mock('../../base/redux/ReducerRegistry', () => {
    return {
        __esModule: true,
        default: { register: (name: string, reducer: Function) => {
            mockRegistered.reducers[name] = reducer;
        } }
    };
});
jest.mock('../../base/redux/PersistenceRegistry', () => {
    return {
        __esModule: true,
        default: { register: jest.fn() }
    };
});

// Imported by base/jwt/functions and chat/actions.any for helpers these tests never reach.
jest.mock('../../jaas/functions', () => {
    return { isVpaasMeeting: () => false };
});
const mockConference: { current?: Object; } = {};

jest.mock('../../base/conference/functions', () => {
    return { getCurrentConference: () => mockConference.current };
});

// For actions.native: the bridge, the hangup thunk and the conference error names.
const mockNativeCalls = { hangup: jest.fn(), openUpgradePlan: jest.fn() };

// Read lazily: the module is imported, and so mocked, before mockNativeCalls is assigned.
jest.mock('react-native', () => {
    return {
        get NativeModules() {
            return { NativeCallsNew: mockNativeCalls };
        }
    };
});
// Only platform files (.native/.web) exist for this module, which this setup does not resolve.
jest.mock('../../base/conference/actions', () => {
    return { leaveConference: () => {
        return { type: 'LEAVE_CONFERENCE' };
    } };
}, { virtual: true });
jest.mock('../../base/lib-jitsi-meet', () => {
    return { JitsiConferenceErrors: { CONFERENCE_DESTROYED: 'conference.destroyed' } };
});
jest.mock('../../base/util/parseURLParams', () => {
    return { parseURLParams: () => ({}) };
});

const mockIsModerator = jest.fn();
const mockIsVoiceTranslationEnabled = jest.fn();

jest.mock('../../base/participants/functions', () => {
    return { isLocalParticipantModerator: () => mockIsModerator() };
});
jest.mock('../../voice-translation/functions', () => {
    return { isVoiceTranslationEnabled: () => mockIsVoiceTranslationEnabled() };
});
jest.mock('../../voice-translation/actions', () => {
    return { disableVoiceTranslation: (options: Object) => {
        return { type: 'DISABLE_VOICE_TRANSLATION', ...options };
    } };
});

import { INCREMENT_FEATURE_USAGE } from '../../base/jwt/actionTypes';
import { isJwtAccessFeatureBlocked } from '../../base/jwt/functions';
import { HIDE_MEETING_LIMIT_DIALOG, SHOW_MEETING_LIMIT_DIALOG } from '../../chat/actionTypes';
import { hideMeetingLimitDialog, showMeetingLimitDialog } from '../../chat/actions.any';
import { SET_S2S_V2_LANGUAGE_POPUP, SET_S2S_V2_PANEL, START_S2S_V2_SESSION } from '../../s2s-v2/actionTypes';
import { SET_REQUESTING_SUBTITLES, TOGGLE_REQUESTING_SUBTITLES } from '../../subtitles/actionTypes';
import { ENABLE_VOICE_TRANSLATION } from '../../voice-translation/actionTypes';
import { SET_WHITEBOARD_OPEN } from '../../whiteboard/actionTypes';
import {
    dismissMeetingLimitDialog,
    isConferenceEndDeferred,
    maybeDeferConferenceEnd,
    upgradePlan
} from '../actions.native';
import {
    checkFeatureAccess,
    checkFeatureUsage,
    commitFeatureUsage,
    consumeServerChatMessage,
    detectMeetingSignal,
    softAlertForUse
} from '../functions';

require('../middleware.any');
require('../../base/jwt/reducer');
require('../../chat/reducer');

type Limit = { alertlimit?: number; enabled?: boolean; limit?: number; used?: number; };

/**
 * A redux state with the given quotas, access flags, captions state and capping popup.
 *
 * @param {Object} options - The pieces of state the gates read.
 * @returns {Object}
 */
function stateWith({ dialog = { open: false }, flags, limits, requestingSubtitles = false }: {
    dialog?: { ended?: boolean; open: boolean; };
    flags?: Record<string, boolean>; limits?: Record<string, Limit>; requestingSubtitles?: boolean;
} = {}) {
    return {
        'features/base/jwt': { featureAccessFlags: flags, featureUsageLimits: limits },
        'features/chat': { meetingLimitDialog: dialog },
        'features/subtitles': { _requestingSubtitles: requestingSubtitles }
    };
}

/**
 * Runs an action through the meeting-warning middleware.
 *
 * @param {Object} state - The redux state.
 * @param {Object} action - The action.
 * @returns {Object} What was dispatched and whether the action was passed on.
 */
function runMiddleware(state: Object, action: { [key: string]: any; type: string; }) {
    const dispatched: any[] = [];
    const store = {
        dispatch: (a: any) => {
            if (typeof a === 'function') {
                return a(store.dispatch, store.getState);
            }
            dispatched.push(a);

            return a;
        },
        getState: () => state
    };
    const next = jest.fn(() => 'next-result');
    const result = mockRegistered.middleware?.(store)(next)(action);

    return {
        dialogs: dispatched.filter(a => a.type === SHOW_MEETING_LIMIT_DIALOG),
        dispatched,
        passedOn: next.mock.calls.length > 0,
        result
    };
}

/**
 * Runs a capping thunk against a state.
 *
 * @param {Function} thunk - The thunk.
 * @param {Object} state - The redux state.
 * @returns {Object} The thunk's result and what it dispatched.
 */
function runThunk(thunk: Function, state: Object) {
    const dispatched: any[] = [];
    const dispatch = (a: any): any => (typeof a === 'function' ? a(dispatch, () => state) : dispatched.push(a));

    return {
        dispatched,
        result: thunk(dispatch, () => state)
    };
}

beforeEach(() => {
    mockIsModerator.mockReturnValue(true);
    mockIsVoiceTranslationEnabled.mockReturnValue(false);
    mockConference.current = {};
    mockNativeCalls.hangup.mockClear();
    mockNativeCalls.openUpgradePlan.mockClear();
});

describe('consumeServerChatMessage', () => {
    it('opens the popup for the server\'s plain-text warning and keeps it out of chat', () => {
        const { dispatched, result } = runThunk(
            consumeServerChatMessage('This session will end in 5 minutes.', true, false), {});

        expect(result).toBe(true);
        expect(dispatched[0].payload.title).toBe('Meeting ending soon');
    });

    it('leaves a participant\'s plain text alone, even when it reads like a warning', () => {
        const { dispatched, result } = runThunk(
            consumeServerChatMessage('the meeting will end in 5 minutes', false, false), {});

        expect(result).toBe(false);
        expect(dispatched).toHaveLength(0);
    });

    it('drops a stale signal replayed from room history without a popup', () => {
        const { dispatched, result } = runThunk(
            consumeServerChatMessage('This session will end in 5 minutes.', true, true), {});

        expect(result).toBe(true);
        expect(dispatched).toHaveLength(0);
    });

    it('keeps the duration announcement and usage telemetry out of chat', () => {
        expect(runThunk(consumeServerChatMessage('This call is limited to 40 minutes.', true, false), {}).result)
            .toBe(true);
        expect(runThunk(consumeServerChatMessage(JSON.stringify({ type: 'melp-usage' }), false, false), {}).result)
            .toBe(true);
    });
});

describe('checkFeatureAccess', () => {
    it('uses the plural copy for breakout rooms', () => {
        const { dispatched, result } = runThunk(checkFeatureAccess('breakoutrooms'),
            stateWith({ flags: { breakoutrooms: false } }));

        expect(result).toBe(false);
        expect(dispatched[0].payload).toEqual({
            message: 'Breakout rooms are not available in your current plan. Upgrade to continue.',
            title: 'Breakout rooms unavailable'
        });
    });
});

describe('popup actions', () => {
    const destroyed = { type: 'CONFERENCE_FAILED', error: { name: 'conference.destroyed', params: [ 'x' ] } };

    it('holds the room end back while "Meeting ended" is up, and replays it on OK', () => {
        const ended = stateWith({ dialog: { ended: true, open: true } });

        expect(runThunk(maybeDeferConferenceEnd(destroyed), ended).result).toBe(true);
        expect(isConferenceEndDeferred()).toBe(true);

        const { dispatched } = runThunk(dismissMeetingLimitDialog(), ended);

        expect(dispatched.map(a => a.type)).toEqual([ HIDE_MEETING_LIMIT_DIALOG, 'CONFERENCE_FAILED' ]);
        expect(isConferenceEndDeferred()).toBe(false);
        expect(mockNativeCalls.hangup).not.toHaveBeenCalled();
    });

    it('does not hold back an unrelated failure', () => {
        expect(runThunk(maybeDeferConferenceEnd(destroyed), stateWith()).result).toBe(false);
    });

    it('leaves like the hangup button when "Meeting ended" is dismissed with nothing held back', () => {
        const { dispatched } = runThunk(dismissMeetingLimitDialog(), stateWith({ dialog: { ended: true, open: true } }));

        expect(dispatched.map(a => a.type)).toEqual([ HIDE_MEETING_LIMIT_DIALOG, 'LEAVE_CONFERENCE' ]);
        expect(mockNativeCalls.hangup).toHaveBeenCalledTimes(1);
    });

    it('only closes a popup raised during the meeting', () => {
        const { dispatched } = runThunk(dismissMeetingLimitDialog(), stateWith({ dialog: { open: true } }));

        expect(dispatched.map(a => a.type)).toEqual([ HIDE_MEETING_LIMIT_DIALOG ]);
    });

    it('asks the Melp host for the plans page on Upgrade', () => {
        runThunk(upgradePlan(), stateWith({ dialog: { open: true } }));

        expect(mockNativeCalls.openUpgradePlan).toHaveBeenCalledTimes(1);
    });
});

describe('detectMeetingSignal', () => {
    it('treats the server\'s plain-text duration warning as a warning', () => {
        expect(detectMeetingSignal('This session will end in 5 minutes.')).toEqual({
            ended: false,
            parsedMessage: 'This session will end in 5 minutes.',
            warning: true
        });
    });

    it('reads explicit JSON flags and returns the embedded message', () => {
        expect(detectMeetingSignal(JSON.stringify({ ended: true, message: 'Bye' }))).toEqual({
            ended: true,
            parsedMessage: 'Bye',
            warning: false
        });
    });

    it('reads the type-based shape', () => {
        expect(detectMeetingSignal(JSON.stringify({ type: 'meeting-warning', message: 'Soon' })).warning).toBe(true);
        expect(detectMeetingSignal(JSON.stringify({ type: 'meeting-ended', message: 'Done' })).ended).toBe(true);
    });

    it('reads "meeting-ending" as the warning, not the end', () => {
        expect(detectMeetingSignal(JSON.stringify({ type: 'meeting-ending', message: 'Soon' }))).toMatchObject({
            ended: false,
            warning: true
        });
    });

    it('leaves ordinary chat alone', () => {
        const signal = detectMeetingSignal('see you tomorrow');

        expect(signal.warning || signal.ended).toBe(false);
    });

    // Recorded as current behaviour, shared with the web client: the server's final message matches neither shape,
    // so the ended popup comes from the room being destroyed rather than from this text.
    it('does not recognise the server\'s "duration reached" message', () => {
        const signal = detectMeetingSignal('Meeting duration reached. Ending call.');

        expect(signal.warning || signal.ended).toBe(false);
    });
});

describe('checkFeatureUsage / commitFeatureUsage', () => {
    it('allows a feature with no quota', () => {
        expect(runThunk(checkFeatureUsage('polls'), stateWith()).result).toBe(true);
    });

    it('blocks an exhausted quota with the hard popup', () => {
        const { dispatched, result } = runThunk(checkFeatureUsage('polls'),
            stateWith({ limits: { polls: { limit: 3, used: 3 } } }));

        expect(result).toBe(false);
        expect(dispatched[0].payload.title).toBe('Polls limit reached');
    });

    it('lets an enabled limit of 0 through - only the Create a poll button treats it as blocked', () => {
        expect(runThunk(checkFeatureUsage('polls'),
            stateWith({ limits: { polls: { enabled: true, limit: 0, used: 0 } } })).result).toBe(true);
    });

    it('treats a disabled limit of 0 as not in the plan', () => {
        const { dispatched, result } = runThunk(checkFeatureUsage('recording'),
            stateWith({ limits: { recording: { enabled: false, limit: 0, used: 0 } } }));

        expect(result).toBe(false);
        expect(dispatched[0].payload.title).toBe('Recording unavailable');
    });

    it('counts a use and keeps the last-unit alert off when asked to', () => {
        const { dispatched } = runThunk(commitFeatureUsage('polls', { showPostLimitAlert: false }),
            stateWith({ limits: { polls: { limit: 3, used: 2 } } }));

        expect(dispatched).toEqual([ { type: INCREMENT_FEATURE_USAGE, feature: 'polls' } ]);
    });

    it('shows the soft alert with the count after this use', () => {
        const { dispatched } = runThunk(softAlertForUse('transcription', 2, 3, 0), {});

        expect(dispatched[0].payload.message).toBe(
            'You have used 3/3 of your Transcription quota. Upgrade to avoid interruption.');
    });
});

describe('meeting-warning middleware', () => {
    const exhaustedS2S = stateWith({ limits: { speech_to_speech: { limit: 2, used: 2 } } });

    it('blocks a moderator starting speech-to-speech on an exhausted quota', () => {
        const { dialogs, passedOn } = runMiddleware(exhaustedS2S, { type: START_S2S_V2_SESSION });

        expect(passedOn).toBe(false);
        expect(dialogs).toHaveLength(1);
    });

    it('never counts speech-to-speech locally', () => {
        const { dispatched, passedOn } = runMiddleware(
            stateWith({ limits: { speech_to_speech: { limit: 5, used: 1 } } }), { type: START_S2S_V2_SESSION });

        expect(passedOn).toBe(true);
        expect(dispatched.some(a => a.type === INCREMENT_FEATURE_USAGE)).toBe(false);
    });

    it('lets a non-moderator\'s start through to the s2s middleware, which refuses it itself', () => {
        mockIsModerator.mockReturnValue(false);

        const { dialogs, passedOn } = runMiddleware(exhaustedS2S, { type: START_S2S_V2_SESSION });

        expect(passedOn).toBe(true);
        expect(dialogs).toHaveLength(0);
    });

    it('passes a remote voice-translation enable without a popup', () => {
        const { dialogs, passedOn } = runMiddleware(exhaustedS2S,
            { type: ENABLE_VOICE_TRANSLATION, broadcast: false });

        expect(passedOn).toBe(true);
        expect(dialogs).toHaveLength(0);
    });

    const exhaustedCaptions = stateWith({ limits: { transcription: { limit: 1, used: 1 } } });

    it('blocks a moderator turning captions on when the quota is used up', () => {
        mockIsVoiceTranslationEnabled.mockReturnValue(true);

        const { dialogs, dispatched, passedOn } = runMiddleware(exhaustedCaptions,
            { type: SET_REQUESTING_SUBTITLES, enabled: true });

        expect(passedOn).toBe(false);
        expect(dialogs).toHaveLength(1);
        expect(dispatched.some(a => a.type === 'DISABLE_VOICE_TRANSLATION')).toBe(true);
    });

    it('always lets captions be turned off', () => {
        const state = stateWith({ limits: { transcription: { limit: 1, used: 1 } }, requestingSubtitles: true });

        expect(runMiddleware(state, { type: SET_REQUESTING_SUBTITLES, enabled: false }).passedOn).toBe(true);
        expect(runMiddleware(state, { type: TOGGLE_REQUESTING_SUBTITLES }).passedOn).toBe(true);
    });

    it('passes captions synced from somebody else\'s session', () => {
        const { dialogs, passedOn } = runMiddleware(exhaustedCaptions,
            { type: SET_REQUESTING_SUBTITLES, enabled: true, fromRemoteSync: true });

        expect(passedOn).toBe(true);
        expect(dialogs).toHaveLength(0);
    });

    it('refuses captions silently when the issuer disabled a transcription quota that has units left', () => {
        const { dialogs, passedOn } = runMiddleware(
            stateWith({ limits: { transcription: { enabled: false, limit: 5, used: 0 } } }),
            { type: SET_REQUESTING_SUBTITLES, enabled: true });

        expect(passedOn).toBe(false);
        expect(dialogs).toHaveLength(0);
    });

    it('shows "unavailable" for live captions the plan does not include', () => {
        const { dialogs, passedOn } = runMiddleware(
            stateWith({ limits: { transcription: { enabled: false, limit: 0, used: 0 } } }),
            { type: SET_REQUESTING_SUBTITLES, enabled: true });

        expect(passedOn).toBe(false);
        expect(dialogs[0].payload.title).toBe('Transcription unavailable');
    });

    it('opens no translation sheet or panel when no session is running', () => {
        expect(runMiddleware(stateWith(), { type: SET_S2S_V2_LANGUAGE_POPUP, visible: true }).passedOn).toBe(false);
        expect(runMiddleware(stateWith(), { type: SET_S2S_V2_PANEL, visible: true }).passedOn).toBe(false);
        expect(runMiddleware(stateWith(), { type: SET_S2S_V2_PANEL, visible: false }).passedOn).toBe(true);
    });

    it('opens the translation sheet once a session is running', () => {
        const running = { ...stateWith(), 'features/s2s-v2': { enabled: true } };

        expect(runMiddleware(running, { type: SET_S2S_V2_LANGUAGE_POPUP, visible: true }).passedOn).toBe(true);
    });

    it('closes a whiteboard the plan does not include, with a popup only for a moderator', () => {
        const state = stateWith({ flags: { whiteboard: false } });
        const moderator = runMiddleware(state, { type: SET_WHITEBOARD_OPEN, isOpen: true });

        expect(moderator.passedOn).toBe(false);
        expect(moderator.dialogs[0].payload.title).toBe('Whiteboard unavailable');

        mockIsModerator.mockReturnValue(false);

        const participant = runMiddleware(state, { type: SET_WHITEBOARD_OPEN, isOpen: true });

        expect(participant.passedOn).toBe(false);
        expect(participant.dialogs).toHaveLength(0);
    });
});

describe('isJwtAccessFeatureBlocked', () => {
    it('reads both spellings of the noise-suppression flag', () => {
        expect(isJwtAccessFeatureBlocked(stateWith({ flags: { noisesupression: false } }) as any,
            'noisesupression')).toBe(true);
        expect(isJwtAccessFeatureBlocked(stateWith({ flags: { noisesuppression: false } }) as any,
            'noisesupression')).toBe(true);
    });

    it('treats a missing flag as allowed', () => {
        expect(isJwtAccessFeatureBlocked(stateWith() as any, 'breakoutrooms')).toBe(false);
    });
});

describe('reducers', () => {
    it('counts a use only for a feature that has a quota', () => {
        const reducer = mockRegistered.reducers['features/base/jwt'];
        const state = { featureUsageLimits: { polls: { limit: 3, used: 1 } } };

        expect(reducer(state, { type: INCREMENT_FEATURE_USAGE, feature: 'polls' }).featureUsageLimits.polls.used)
            .toBe(2);
        expect(reducer(state, { type: INCREMENT_FEATURE_USAGE, feature: 'summary' })).toBe(state);
    });

    it('opens and closes the capping popup', () => {
        const reducer = mockRegistered.reducers['features/chat'];
        const opened = reducer(undefined, showMeetingLimitDialog({ message: 'm', title: 't', ended: true }));

        expect(opened.meetingLimitDialog).toEqual({ ended: true, message: 'm', open: true, title: 't' });
        expect(reducer(opened, hideMeetingLimitDialog()).meetingLimitDialog).toEqual({ open: false });
        expect(hideMeetingLimitDialog().type).toBe(HIDE_MEETING_LIMIT_DIALOG);
    });
});
