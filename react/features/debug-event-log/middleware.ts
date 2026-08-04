import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import { logEvent } from './actions';
import { CLEAR_EVENT_LOG, LOG_EVENT } from './actionTypes';

declare const __DEV__: boolean;

const ACTION_TYPES_TO_LOG = new Set([
    'CONFERENCE_WILL_JOIN',
    'CONFERENCE_JOINED',
    'CONFERENCE_LEFT',
    'CONFERENCE_FAILED',
    'CONFERENCE_TERMINATED',
    'CONFERENCE_UNIQUE_ID_SET',
    'PARTICIPANT_JOINED',
    'PARTICIPANT_LEFT',
    'ENDPOINT_MESSAGE_RECEIVED',
    'SCREEN_SHARE_TOGGLED',
    'CHAT_MESSAGE_RECEIVED',
    'CHAT_TOGGLED',
    'AUDIO_MUTED_CHANGED',
    'VIDEO_MUTED_CHANGED',
    'RECORDING_SESSION_UPDATED',
    'READY_TO_CLOSE'
]);

if (typeof __DEV__ !== 'undefined' && __DEV__) {
    MiddlewareRegistry.register(store => next => action => {
        if (action.type !== LOG_EVENT && action.type !== CLEAR_EVENT_LOG && ACTION_TYPES_TO_LOG.has(action.type)) {
            store.dispatch(logEvent({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: action.type,
                payload: action,
                source: 'redux',
                timestamp: Date.now()
            }));
        }

        return next(action);
    });
}
