import { NativeModules } from 'react-native';

import { IReduxState } from '../../app/types';
import { getLocalJitsiVideoTrack } from '../../base/tracks/functions.native';

import { BUNDLED_IMAGES, IVirtualBackgroundImage, VIRTUAL_BACKGROUND_TYPE } from './constants';

const { JitsiVirtualBackground } = NativeModules;

/**
 * The native module which owns the background selection and the frame processor. Only available on
 * Android.
 */
export const nativeModule = JitsiVirtualBackground;

/**
 * Whether the platform can composite a virtual background into the local camera stream. The frame
 * processor is Android only, and the feature can additionally be turned off through config.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isVirtualBackgroundSupported(state: IReduxState) {
    return Boolean(nativeModule?.setBackground)
        && state['features/base/config'].disableVirtualBackground !== true;
}

/**
 * Returns the state of the virtual background feature.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IMobileVirtualBackgroundState}
 */
export function getVirtualBackgroundState(state: IReduxState) {
    return state['features/mobile/virtual-background'];
}

/**
 * Whether a background is currently being composited into the local camera stream.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isVirtualBackgroundEnabled(state: IReduxState) {
    return getVirtualBackgroundState(state).backgroundType !== VIRTUAL_BACKGROUND_TYPE.NONE;
}

/**
 * Returns every background the user can choose from: the ones bundled with the app followed by the
 * ones imported from the gallery, most recently imported first.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IVirtualBackgroundImage[]}
 */
export function getVirtualBackgroundImages(state: IReduxState): IVirtualBackgroundImage[] {
    const { storedImages } = getVirtualBackgroundState(state);

    return [
        ...storedImages.map(uri => ({
            id: uri,
            stored: true,
            uri
        })).reverse(),
        ...BUNDLED_IMAGES
    ];
}

/**
 * Returns the underlying {@code MediaStreamTrack} of the local camera, which is what carries
 * react-native-webrtc's video effect API.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {any} The track, or {@code undefined} if the camera is off.
 */
export function getLocalVideoMediaStreamTrack(state: IReduxState) {
    const jitsiTrack = getLocalJitsiVideoTrack(state);

    if (!jitsiTrack || jitsiTrack.isMuted()) {
        return undefined;
    }

    return jitsiTrack.getTrack?.();
}
