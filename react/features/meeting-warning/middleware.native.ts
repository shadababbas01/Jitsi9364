import { APP_WILL_UNMOUNT } from '../base/app/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import StateListenerRegistry from '../base/redux/StateListenerRegistry';
import { hideMeetingLimitDialog } from '../chat/actions.any';

import { clearDeferredConferenceEnd, isConferenceEndDeferred } from './actions.native';
import './middleware.any';

MiddlewareRegistry.register(() => next => action => {
    if (action.type === APP_WILL_UNMOUNT) {
        clearDeferredConferenceEnd();
    }

    return next(action);
});

/**
 * The popup belongs to the call it was raised in. The redux store outlives every call on mobile, so one still up
 * when its conference goes away (the user hung up behind it) would otherwise greet the next call.
 */
StateListenerRegistry.register(
    state => getCurrentConference(state),
    (conference, { dispatch, getState }, previousConference) => {
        if (previousConference
                && conference !== previousConference
                && getState()['features/chat'].meetingLimitDialog.open
                && !isConferenceEndDeferred()) {
            dispatch(hideMeetingLimitDialog());
        }
    });
