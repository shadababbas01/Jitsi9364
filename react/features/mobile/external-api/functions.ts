import { debounce } from 'lodash-es';
import { NativeModules } from 'react-native';

import { IParticipant } from '../../base/participants/types';
import { logEvent } from '../../debug-event-log/actions';

import { readyToClose } from './actions';


/**
 * Sends a specific event to the native counterpart of the External API. Native
 * apps may listen to such events via the mechanisms provided by the (native)
 * mobile Jitsi Meet SDK.
 *
 * @param {Object} store - The redux store.
 * @param {string} name - The name of the event to send.
 * @param {Object} data - The details/specifics of the event to send determined
 * by/associated with the specified {@code name}.
 * @returns {void}
 */
export function sendEvent(store: Object, name: string, data: Object) {
    NativeModules.ExternalAPI.sendEvent(name, data);

    // Debug-only event logging for native outbound events.
    // @ts-ignore
    if (typeof __DEV__ !== 'undefined' && __DEV__ && store?.dispatch) {
        // @ts-ignore
        store.dispatch(logEvent({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            payload: data,
            source: 'js->native',
            timestamp: Date.now()
        }));
    }
}

/**
 * Debounced sending of `readyToClose`.
 */
export const _sendReadyToClose = debounce(dispatch => {
    dispatch(readyToClose());
}, 2500, { leading: true });

/**
 * Returns a participant info object based on the passed participant object from redux.
 *
 * @param {Participant} participant - The participant object from the redux store.
 * @returns {Object} - The participant info object.
 */
export function participantToParticipantInfo(participant: IParticipant) {
    return {
        isLocal: participant.local,
        email: participant.email,
        name: participant.name,
        participantId: participant.id,
        displayName: participant.displayName,
        avatarUrl: participant.avatarURL,
        role: participant.role
    };
}
