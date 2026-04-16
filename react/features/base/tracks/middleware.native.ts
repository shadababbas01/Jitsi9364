import { IStore } from '../../app/types';
import {
    getParticipantDisplayName,
    getRemoteParticipants,
    isScreenShareParticipant
} from '../participants/functions';
import { SET_AUDIO_MUTED } from '../media/actionTypes';
import {
    MEDIA_TYPE,
    VIDEO_TYPE
} from '../media/constants';
import { hideNotification, showWarningNotification } from '../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../notifications/constants';
import {
    isTrackStreamingStatusInactive,
    isTrackStreamingStatusInterrupted
} from '../../connection-indicator/functions';
import MiddlewareRegistry from '../redux/MiddlewareRegistry';

import {
    TRACK_REMOVED,
    TRACK_UPDATED
} from './actionTypes';
import {
    createLocalTracksA,
    toggleScreensharing,
    trackMuteUnmuteFailed
} from './actions.native';
import { getLocalTrack, setTrackMuted } from './functions.any';

import './middleware.any';

const REMOTE_STREAMING_ISSUES_NOTIFICATION_UID = 'streaming-issue-remote-group';

/**
 * Middleware that captures LIB_DID_DISPOSE and LIB_DID_INIT actions and,
 * respectively, creates/destroys local media tracks. Also listens to
 * media-related actions and performs corresponding operations with tracks.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {
    case SET_AUDIO_MUTED: {
        _setMuted(store, action);
        break;
    }
    case TRACK_REMOVED: {
        const result = next(action);

        _syncRemoteStreamingIssuesNotification(store);

        return result;
    }
    case TRACK_UPDATED: {
        const { jitsiTrack, local } = action.track;
        const result = next(action);

        if (local && jitsiTrack.isMuted()
                    && jitsiTrack.type === MEDIA_TYPE.VIDEO && jitsiTrack.videoType === VIDEO_TYPE.DESKTOP) {
            store.dispatch(toggleScreensharing(false));
        }

        if (!local && action.track.mediaType === MEDIA_TYPE.VIDEO) {
            _syncRemoteStreamingIssuesNotification(store);
        }

        return result;
    }
    }

    return next(action);
});

function _syncRemoteStreamingIssuesNotification({ dispatch, getState }: IStore) {
    const state = getState();
    const remoteIssueParticipants = new Map<string, { displayName: string; interrupted: boolean; }>();

    for (const [ id, participant ] of getRemoteParticipants(state)) {
        if (!id || isScreenShareParticipant(participant)) {
            continue;
        }

        const track = state['features/base/tracks'].find(t =>
            !t.local && t.mediaType === MEDIA_TYPE.VIDEO && t.participantId === id);

        if (!track) {
            continue;
        }

        const interrupted = isTrackStreamingStatusInterrupted(track);
        const inactive = isTrackStreamingStatusInactive(track);

        if (!interrupted && !inactive) {
            continue;
        }

        const existingIssue = remoteIssueParticipants.get(id);

        if (!existingIssue || interrupted) {
            remoteIssueParticipants.set(id, {
                displayName: getParticipantDisplayName(state, id) || 'This participant',
                interrupted
            });
        }
    }

    if (!remoteIssueParticipants.size) {
        dispatch(hideNotification(REMOTE_STREAMING_ISSUES_NOTIFICATION_UID));

        return;
    }

    const issues = Array.from(remoteIssueParticipants.values());
    const issueCount = issues.length;
    const interruptedCount = issues.filter(issue => issue.interrupted).length;
    const allInterrupted = interruptedCount === issueCount;
    let title = 'Unstable network';
    let description = `${issueCount} participants have an unstable network.`;

    if (issueCount === 1) {
        title = allInterrupted ? 'Reconnecting' : 'Unstable network';
        description = allInterrupted
            ? `${issues[0].displayName} is reconnecting.`
            : `${issues[0].displayName} has an unstable network.`;
    } else if (allInterrupted) {
        title = 'Reconnecting';
        description = `${issueCount} participants are reconnecting.`;
    }

    dispatch(showWarningNotification({
        description,
        title,
        uid: REMOTE_STREAMING_ISSUES_NOTIFICATION_UID
    }, NOTIFICATION_TIMEOUT_TYPE.STICKY));
}

/**
 * Mutes or unmutes a local track with a specific media type.
 *
 * @param {Store} store - The redux store in which the specified action is dispatched.
 * @param {Action} action - The redux action dispatched in the specified store.
 * @private
 * @returns {void}
 */
function _setMuted(store: IStore, { ensureTrack, muted }: {
    ensureTrack: boolean; muted: boolean; }) {
    const { dispatch, getState } = store;
    const state = getState();
    const localTrack = getLocalTrack(state['features/base/tracks'], MEDIA_TYPE.AUDIO, /* includePending */ true);

    if (localTrack) {
        // The `jitsiTrack` property will have a value only for a localTrack for which `getUserMedia` has already
        // completed. If there's no `jitsiTrack`, then the `muted` state will be applied once the `jitsiTrack` is
        // created.
        const { jitsiTrack } = localTrack;

        if (jitsiTrack) {
            setTrackMuted(jitsiTrack, muted, state, dispatch)
                .catch(() => dispatch(trackMuteUnmuteFailed(localTrack, muted)));
        }
    } else if (!muted && ensureTrack) {
        dispatch(createLocalTracksA({ devices: [ MEDIA_TYPE.AUDIO ] }));
    }
}
