import { NativeModules } from 'react-native';

import { IReduxState } from '../../app/types';

import type { IRawDevice } from './components/AudioRoutePickerDialog';
import { AUDIO_DEVICE_SPEAKER, PRIVATE_AUDIO_DEVICES } from './constants';
import logger from './logger';

const { AudioMode } = NativeModules;

/**
 * Returns the routes the call can be put on, as native last announced them.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IRawDevice[]}
 */
export function getAudioDevices(state: IReduxState): IRawDevice[] {
    return state['features/mobile/audio-mode']?.devices ?? [];
}

/**
 * Returns the route the call is currently on, if native has told us of one.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IRawDevice|undefined}
 */
export function getSelectedAudioDevice(state: IReduxState): IRawDevice | undefined {
    return getAudioDevices(state).find(device => device.selected);
}

/**
 * Returns whether the call is coming out of the phone's loudspeaker.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isSpeakerSelected(state: IReduxState): boolean {
    return getSelectedAudioDevice(state)?.type === AUDIO_DEVICE_SPEAKER;
}

/**
 * Returns whether the call is on a route which only the user can hear - a headset, earbuds or a car.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isPrivateAudioDeviceSelected(state: IReduxState): boolean {
    const selected = getSelectedAudioDevice(state);

    return Boolean(selected && PRIVATE_AUDIO_DEVICES.includes(selected.type));
}

/**
 * Puts the call on a route, by device type or by the unique identifier native gave it.
 *
 * The one place which asks native for a route, so that a feature which needs the loudspeaker does not have to know how
 * the two platforms differ about it: Android answers nothing at all, iOS answers a promise which rejects when the route
 * cannot be taken, and an unhandled rejection there is a warning in the log of an app which is otherwise fine.
 *
 * @param {string} device - The device type, or the unique identifier of one route of that type.
 * @returns {void}
 */
export function selectAudioDevice(device: string): void {
    Promise.resolve(AudioMode?.setAudioDevice?.(device))
        .catch((error: any) => logger.warn(`Could not route audio to ${device}`, error));

    // Android announces the new route as it takes it and iOS announces it from the route change that follows, so this
    // is only for the case where the route asked for was already the one in use: nothing changes, so nothing is
    // announced, and a caller which is waiting to see the route it asked for would wait for good.
    AudioMode?.updateDeviceList?.();
}
