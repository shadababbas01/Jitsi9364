import { NativeModules } from 'react-native';
import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { leaveConference } from '../base/conference/actions';
import { getCurrentConference } from '../base/conference/functions';
import { JitsiConferenceErrors } from '../base/lib-jitsi-meet';
import { hideMeetingLimitDialog, showMeetingLimitDialog } from '../chat/actions.any';

import { detectMeetingSignal, isMeetingEndedDialogOpen, meetingSignalDialog } from './functions';
import logger from './logger';

/**
 * How long a destroyed conference waits for the "Meeting ended" popup to be acknowledged before it is torn down
 * anyway: the call stays up until then, so it cannot wait forever for someone who has walked away from the phone.
 */
const MEETING_END_ACK_TIMEOUT = 30 * 1000;

/**
 * The room-destroyed CONFERENCE_FAILED held back while the "Meeting ended" popup is on screen.
 */
let deferredEnd: {
    action: AnyAction;
    timer: ReturnType<typeof setTimeout>;
} | undefined;

/**
 * Called with every CONFERENCE_FAILED before it is dispatched. When the room was destroyed because the meeting hit
 * its plan duration, holds the failure back so the "Meeting ended" popup stays on screen: dispatching it leaves the
 * meeting and the Melp host closes the call screen with the popup in it. The failure is dispatched unchanged once
 * the popup is dismissed, so everything downstream sees what it always did, only later.
 *
 * @param {AnyAction} action - The CONFERENCE_FAILED action.
 * @returns {Function} A thunk resolving to true when the action was held back.
 */
export function maybeDeferConferenceEnd(action: AnyAction) {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']): boolean => {
        if (action.error?.name !== JitsiConferenceErrors.CONFERENCE_DESTROYED || deferredEnd) {
            return false;
        }

        if (!isMeetingEndedDialogOpen(getState())) {
            // The server may only say why in the destroy reason.
            const [ reason ] = action.error?.params ?? [];
            const signal = typeof reason === 'string' ? detectMeetingSignal(reason) : undefined;

            if (!signal?.ended) {
                return false;
            }

            dispatch(showMeetingLimitDialog(meetingSignalDialog(signal.parsedMessage, true)));
        }

        logger.info('Holding back the end of the conference until "Meeting ended" is acknowledged');

        deferredEnd = {
            action,
            timer: setTimeout(() => {
                logger.info('"Meeting ended" not acknowledged in time, ending the conference');
                dispatch(hideMeetingLimitDialog());
                dispatch(releaseDeferredConferenceEnd());
            }, MEETING_END_ACK_TIMEOUT)
        };

        return true;
    };
}

/**
 * Replays the CONFERENCE_FAILED held back by {@link maybeDeferConferenceEnd}.
 *
 * @returns {Function} A thunk resolving to true when there was one.
 */
export function releaseDeferredConferenceEnd() {
    return (dispatch: IStore['dispatch']): boolean => {
        if (!deferredEnd) {
            return false;
        }

        const { action, timer } = deferredEnd;

        clearTimeout(timer);
        deferredEnd = undefined;
        dispatch(action);

        return true;
    };
}

/**
 * Drops a held-back end without replaying it, for when the React root goes away: the store it would be replayed
 * into goes with it.
 *
 * @returns {void}
 */
export function clearDeferredConferenceEnd() {
    if (deferredEnd) {
        clearTimeout(deferredEnd.timer);
        deferredEnd = undefined;
    }
}

/**
 * Whether an end is being held back for the "Meeting ended" popup.
 *
 * @returns {boolean}
 */
export function isConferenceEndDeferred() {
    return Boolean(deferredEnd);
}

/**
 * Closes the popup. Closing the "Meeting ended" one leaves the meeting: through the held-back room destruction when
 * there is one, otherwise the way the hangup button does.
 *
 * @returns {Function}
 */
export function dismissMeetingLimitDialog() {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const ended = isMeetingEndedDialogOpen(getState()) || !getCurrentConference(getState());

        dispatch(hideMeetingLimitDialog());

        if (!ended || dispatch(releaseDeferredConferenceEnd())) {
            return;
        }

        // When the server already destroyed the room, the app has left it by itself.
        if (getCurrentConference(getState())) {
            NativeModules?.NativeCallsNew?.hangup?.();
            dispatch(leaveConference());
        }
    };
}

/**
 * The Upgrade button. The Melp host owns the signed-in plans page, so the meeting asks it to open the page and
 * keeps running underneath.
 *
 * @returns {Function}
 */
export function upgradePlan() {
    return (dispatch: IStore['dispatch']) => {
        dispatch(hideMeetingLimitDialog());
        NativeModules?.NativeCallsNew?.openUpgradePlan?.();
    };
}
