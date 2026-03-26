import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { openDialog } from '../base/dialog/actions';
import { INCREMENT_FEATURE_USAGE } from '../base/jwt/actionTypes';
import { isJwtAccessFeatureBlocked } from '../base/jwt/functions';
import { IFeatureUsageLimit } from '../base/jwt/reducer';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SET_NOISE_SUPPRESSION_ENABLED } from '../noise-suppression/actionTypes';
import { SAVE_POLL } from '../polls/actionTypes';
import { START_LOCAL_RECORDING } from '../recording/actionTypes';
import { SET_REQUESTING_SUBTITLES } from '../subtitles/actionTypes';
import { SET_WHITEBOARD_OPEN } from '../whiteboard/actionTypes';

import MeetingLimitDialog from './components/native/MeetingLimitDialog';

type TrackedFeature = 'polls' | 'recording' | 'transcription';

const FEATURE_LABEL: Record<TrackedFeature, string> = {
    polls: 'Polls',
    recording: 'Recording',
    transcription: 'Transcription'
};

function _toPositiveInt(value: unknown) {
    const n = Number(value);

    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function _getFeatureLimit(state: any, feature: TrackedFeature): IFeatureUsageLimit | undefined {
    return state?.['features/base/jwt']?.featureUsageLimits?.[feature];
}

function _openMeetingLimitDialog(dispatch: IStore['dispatch'], title: string, message: string) {
    dispatch(openDialog('MeetingLimitDialog', MeetingLimitDialog, {
        message,
        title
    }));
}

function _showSoftAlert(dispatch: IStore['dispatch'], feature: TrackedFeature, used: number, limit: number) {
    _openMeetingLimitDialog(
        dispatch,
        `${FEATURE_LABEL[feature]} limit warning`,
        `You have used ${used}/${limit} of your ${FEATURE_LABEL[feature]} quota. Upgrade to avoid interruption.`
    );
}

function _showHardLimit(dispatch: IStore['dispatch'], feature: TrackedFeature, limit: number) {
    _openMeetingLimitDialog(
        dispatch,
        `${FEATURE_LABEL[feature]} limit reached`,
        `You have reached your ${FEATURE_LABEL[feature]} limit (${limit}). Upgrade your plan to continue.`
    );
}

function _showFeatureBlocked(dispatch: IStore['dispatch'], featureLabel: string) {
    _openMeetingLimitDialog(
        dispatch,
        `${featureLabel} unavailable`,
        `${featureLabel} is not available in your current plan. Upgrade to continue.`
    );
}

function _consumeFeatureUsage(store: IStore, feature: TrackedFeature, runAction: () => unknown) {
    const beforeState = store.getState();
    const featureLimit = _getFeatureLimit(beforeState, feature);

    if (!featureLimit) {
        return runAction();
    }

    const used = _toPositiveInt(featureLimit.used);
    const limit = _toPositiveInt(featureLimit.limit);
    const alertlimit = _toPositiveInt(featureLimit.alertlimit);
    const enabled = featureLimit.enabled !== false;

    if (!enabled) {
        _showFeatureBlocked(store.dispatch, FEATURE_LABEL[feature]);

        return;
    }

    if (limit > 0 && used >= limit) {
        _showHardLimit(store.dispatch, feature, limit);

        return;
    }

    const result = runAction();
    const nextUsed = used + 1;

    store.dispatch({
        type: INCREMENT_FEATURE_USAGE,
        feature
    });

    if (limit > 0 && nextUsed >= limit) {
        _showHardLimit(store.dispatch, feature, limit);
    } else if (alertlimit > 0 && used < alertlimit && nextUsed >= alertlimit) {
        _showSoftAlert(store.dispatch, feature, nextUsed, limit > 0 ? limit : nextUsed);
    }

    return result;
}

MiddlewareRegistry.register((store: IStore) => (next: Function) => (action: AnyAction) => {
    const state = store.getState();

    switch (action.type) {
    case SET_WHITEBOARD_OPEN:
        if (Boolean(action.isOpen) && isJwtAccessFeatureBlocked(state, 'whiteboard')) {
            _showFeatureBlocked(store.dispatch, 'Whiteboard');

            return;
        }

        return next(action);

    case SET_NOISE_SUPPRESSION_ENABLED:
        if (Boolean(action.enabled) && isJwtAccessFeatureBlocked(state, 'noisesupression')) {
            _showFeatureBlocked(store.dispatch, 'Noise Suppression');

            return;
        }

        return next(action);

    case SAVE_POLL: {
        const pollId = action.poll?.pollId;
        const pollExists = Boolean(pollId && state['features/polls']?.polls?.[pollId]);

        if (pollExists) {
            return next(action);
        }

        return _consumeFeatureUsage(store, 'polls', () => next(action));
    }

    case START_LOCAL_RECORDING:
        return _consumeFeatureUsage(store, 'recording', () => next(action));

    case SET_REQUESTING_SUBTITLES: {
        const wasRequesting = Boolean(state['features/subtitles']?._requestingSubtitles);
        const enablingNow = Boolean(action.enabled) && !wasRequesting;

        if (!enablingNow) {
            return next(action);
        }

        return _consumeFeatureUsage(store, 'transcription', () => next(action));
    }
    }

    return next(action);
});
