import { NativeEventEmitter, NativeModules } from 'react-native';
import { AnyAction } from 'redux';

import { IReduxState, IStore } from '../../app/types';
import { APP_WILL_MOUNT, APP_WILL_UNMOUNT } from '../../base/app/actionTypes';
import { SET_AUDIO_ONLY } from '../../base/audio-only/actionTypes';
import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT
} from '../../base/conference/actionTypes';
import { getCurrentConference } from '../../base/conference/functions';
import { SET_CONFIG } from '../../base/config/actionTypes';
import { AUDIO_FOCUS_DISABLED } from '../../base/flags/constants';
import { getFeatureFlag } from '../../base/flags/functions';
import MiddlewareRegistry from '../../base/redux/MiddlewareRegistry';
import { parseURIString } from '../../base/util/uri';

import { _SET_AUDIOMODE_DEVICES, _SET_AUDIOMODE_SUBSCRIPTIONS } from './actionTypes';
import { AUDIO_DEVICE_EARPIECE, AUDIO_DEVICE_SPEAKER } from './constants';
import {
    getAudioDevices,
    isPrivateAudioDeviceAvailable,
    isPrivateAudioDeviceSelected,
    selectAudioDevice
} from './functions';
import logger from './logger';

const { AudioMode } = NativeModules;
const AudioModeEmitter = new NativeEventEmitter(AudioMode);

/**
 * Middleware that captures conference actions and sets the correct audio mode
 * based on the type of conference. Audio-only conferences don't use the speaker
 * by default, and video conferences do.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    /* eslint-disable no-fallthrough */

    switch (action.type) {
    case _SET_AUDIOMODE_SUBSCRIPTIONS:
        _setSubscriptions(store);
        break;
    case APP_WILL_UNMOUNT: {
        store.dispatch({
            type: _SET_AUDIOMODE_SUBSCRIPTIONS,
            subscriptions: undefined
        });
        break;
    }
    case APP_WILL_MOUNT:
        _appWillMount(store);
    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT:

    /*
    * NOTE: We moved the audio mode setting from CONFERENCE_WILL_JOIN to
    * CONFERENCE_JOINED because in case of a locked room, the app goes
    * through CONFERENCE_FAILED state and gets to CONFERENCE_JOINED only
    * after a correct password, so we want to make sure we have the correct
    * audio mode set up when we finally get to the conf, but also make sure
    * that the app is in the right audio mode if the user leaves the
    * conference after the password prompt appears.
    */
    case CONFERENCE_JOINED:
        return _conferenceJoined(store, next, action);

    case SET_AUDIO_ONLY:
        return _setAudioOnly(store, next, action);

    case SET_CONFIG: {
        const { locationURL } = store.getState()['features/base/connection'];
        const location = parseURIString(locationURL?.href ?? '');

        /**
         * Don't touch the current value if there is no room in the URL. This
         * avoids audio cutting off for a moment right after the user leaves
         * a meeting. The next meeting join will set it to the right value.
         */
        if (location.room) {
            const { startSilent } = action.config;

            AudioMode.setDisabled?.(Boolean(startSilent));
        }

        break;
    }
    }

    /* eslint-enable no-fallthrough */

    return next(action);
});

/**
 * Notifies this feature that the action {@link APP_WILL_MOUNT} is being
 * dispatched within a specific redux {@code store}.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @private
 * @returns {void}
 */
function _appWillMount(store: IStore) {
    const subscriptions = [
        AudioModeEmitter.addListener(AudioMode.DEVICE_CHANGE_EVENT, _onDevicesUpdate, store)
    ];

    store.dispatch({
        type: _SET_AUDIOMODE_SUBSCRIPTIONS,
        subscriptions
    });
}

/**
 * Handles audio device changes. The list will be stored on the redux store.
 *
 * @param {Object} devices - The current list of devices.
 * @private
 * @returns {void}
 */
function _onDevicesUpdate(devices: any) {
    // @ts-ignore
    const { dispatch } = this; // eslint-disable-line @typescript-eslint/no-invalid-this

    dispatch({
        type: _SET_AUDIOMODE_DEVICES,
        devices
    });
}

/**
 * Notifies this feature that the action
 * {@link _SET_AUDIOMODE_SUBSCRIPTIONS} is being dispatched within
 * a specific redux {@code store}.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @private
 * @returns {void}
 */
function _setSubscriptions({ getState }: IStore) {
    const { subscriptions } = getState()['features/mobile/audio-mode'];

    if (subscriptions) {
        for (const subscription of subscriptions) {
            subscription.remove();
        }
    }
}

/**
 * Updates the audio mode and, when the call switches between the audio and the video screen, moves the call to the
 * loudspeaker (video) or the earpiece (audio). A headset, earbuds or a car are left alone.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} in the specified {@code store}.
 * @param {Action} action - The redux action {@code SET_AUDIO_ONLY}.
 * @private
 * @returns {*} The value returned by {@code next(action)}.
 */
function _setAudioOnly(store: IStore, next: Function, action: AnyAction) {
    const wasAudioOnly = Boolean(store.getState()['features/base/audio-only'].enabled);
    const result = _updateAudioMode(store, next, action);
    const state = store.getState();
    const audioOnly = Boolean(state['features/base/audio-only'].enabled);

    if (wasAudioOnly === audioOnly
            || !getCurrentConference(state)
            || getFeatureFlag(state, AUDIO_FOCUS_DISABLED, false)
            || isPrivateAudioDeviceSelected(state)) {
        return result;
    }

    _routeForCallType(state, audioOnly);

    return result;
}

/**
 * Updates the audio mode and, when a video call is joined (picked up or dialled), puts it on the loudspeaker. Native
 * already starts an audio call on the earpiece, and a headset, earbuds or a car are left alone.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} in the specified {@code store}.
 * @param {Action} action - The redux action {@code CONFERENCE_JOINED}.
 * @private
 * @returns {*} The value returned by {@code next(action)}.
 */
function _conferenceJoined(store: IStore, next: Function, action: AnyAction) {
    const result = _updateAudioMode(store, next, action);
    const state = store.getState();
    const audioOnly = Boolean(state['features/base/audio-only'].enabled);

    if (audioOnly
            || getFeatureFlag(state, AUDIO_FOCUS_DISABLED, false)
            || isPrivateAudioDeviceAvailable(state)) {
        return result;
    }

    _routeForCallType(state, audioOnly);

    return result;
}

/**
 * Puts the call on the loudspeaker for a video call and on the earpiece for an audio call.
 *
 * @param {IReduxState} state - The redux state.
 * @param {boolean} audioOnly - Whether the call is an audio call.
 * @private
 * @returns {void}
 */
function _routeForCallType(state: IReduxState, audioOnly: boolean) {
    const speakerOn = !audioOnly;
    const type = speakerOn ? AUDIO_DEVICE_SPEAKER : AUDIO_DEVICE_EARPIECE;
    const device = getAudioDevices(state).find(d => d.type === type);

    selectAudioDevice(device?.uid || type);
    AudioMode.setSpeakerOn?.(speakerOn)?.catch?.(() => { /* not every platform answers */ });
}

/**
 * Updates the audio mode based on the current (redux) state.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux {@code dispatch} function to dispatch the
 * specified {@code action} in the specified {@code store}.
 * @param {Action} action - The redux action which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {*} The value returned by {@code next(action)}.
 */
function _updateAudioMode({ getState }: IStore, next: Function, action: AnyAction) {
    const result = next(action);
    const state = getState();
    const conference = getCurrentConference(state);
    const { enabled: audioOnly } = state['features/base/audio-only'];
    let mode: string;

    if (getFeatureFlag(state, AUDIO_FOCUS_DISABLED, false)) {
        return result;
    } else if (conference) {
        mode = audioOnly ? AudioMode.AUDIO_CALL : AudioMode.VIDEO_CALL;
    } else {
        mode = AudioMode.DEFAULT;
    }

    AudioMode.setMode(mode).catch((err: any) => logger.error(`Failed to set audio mode ${String(mode)}: ${err}`));

    return result;
}
