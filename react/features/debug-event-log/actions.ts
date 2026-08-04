import { CLEAR_EVENT_LOG, LOG_EVENT } from './actionTypes';
import { IEventLogEntry } from './reducer';

export function logEvent(entry: IEventLogEntry) {
    return {
        type: LOG_EVENT,
        entry
    };
}

export function clearEventLog() {
    return {
        type: CLEAR_EVENT_LOG
    };
}
