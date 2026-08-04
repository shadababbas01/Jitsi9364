import ReducerRegistry from '../base/redux/ReducerRegistry';

import { CLEAR_EVENT_LOG, LOG_EVENT } from './actionTypes';

const MAX_EVENT_LOGS = 200;

export interface IEventLogEntry {
    id: string;
    name: string;
    timestamp: number;
    payload?: any;
    source?: string;
}

export interface IDebugEventLogState {
    entries: IEventLogEntry[];
}

const DEFAULT_STATE: IDebugEventLogState = {
    entries: []
};

ReducerRegistry.register<IDebugEventLogState>('features/debug-event-log', (state = DEFAULT_STATE, action): IDebugEventLogState => {
    switch (action.type) {
    case LOG_EVENT: {
        const nextEntries = [ ...state.entries, action.entry ];

        if (nextEntries.length > MAX_EVENT_LOGS) {
            nextEntries.splice(0, nextEntries.length - MAX_EVENT_LOGS);
        }

        return {
            ...state,
            entries: nextEntries
        };
    }
    case CLEAR_EVENT_LOG:
        return {
            ...state,
            entries: []
        };
    default:
        return state;
    }
});
