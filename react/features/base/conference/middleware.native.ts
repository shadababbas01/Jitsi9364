import { appNavigate } from '../../app/actions.native';
import { openDialog } from '../../base/dialog/actions';
import { JitsiConferenceErrors } from '../lib-jitsi-meet';
import MiddlewareRegistry from '../redux/MiddlewareRegistry';
import MeetingLimitDialog from '../../meeting-warning/components/native/MeetingLimitDialog';
import { getMeetingLimitDialogPropsFromError } from '../../meeting-warning/functions';

import { CONFERENCE_FAILED } from './actionTypes';
import { conferenceLeft } from './actions.native';
import { TRIGGER_READY_TO_CLOSE_REASONS } from './constants';
import './middleware.any';
import { processDestroyConferenceEvent } from './functions';

MiddlewareRegistry.register(store => next => action => {
    const { dispatch } = store;
    const { error } = action;

    switch (action.type) {
    case CONFERENCE_FAILED: {
        const { getState } = store;
        const state = getState();
        const { notifyOnConferenceDestruction = true } = state['features/base/config'];

        if (error?.name !== JitsiConferenceErrors.CONFERENCE_DESTROYED) {
            break;
        }

        if (processDestroyConferenceEvent(state, dispatch, error.params)) {
            break;
        }

        if (!notifyOnConferenceDestruction) {
            dispatch(conferenceLeft(action.conference));
            dispatch(appNavigate(undefined));
            break;
        }

        const [ reason ] = error.params;

        const reasonKey = Object.keys(TRIGGER_READY_TO_CLOSE_REASONS)[
            Object.values(TRIGGER_READY_TO_CLOSE_REASONS).indexOf(reason)
        ];

        // eslint-disable-next-line no-console
        console.log('Conference failed reason = ', reason, reasonKey);
        const meetingLimitDialogProps = getMeetingLimitDialogPropsFromError(error);

        dispatch(conferenceLeft(action.conference));
        dispatch(appNavigate(undefined));

        if (meetingLimitDialogProps) {
            dispatch(openDialog('MeetingLimitDialog', MeetingLimitDialog, meetingLimitDialogProps));
        }
    }
    }

    return next(action);
});
