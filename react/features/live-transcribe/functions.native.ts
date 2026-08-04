import { NativeModules, Platform } from 'react-native';

export * from './functions.any';

const { LocalAudioTap } = NativeModules;

export interface ILocalAudioTapNativeModule {
    isAvailable: () => Promise<boolean>;
    start: () => Promise<boolean>;
    stop: () => void;
}

/**
 * Returns the bridge to the microphone tap, if this platform has one. Reading the microphone during a call means
 * attaching to the WebRTC audio device module, which is only wired up on Android for now.
 *
 * @returns {ILocalAudioTapNativeModule | undefined}
 */
export function getLocalAudioTapNativeModule(): ILocalAudioTapNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return LocalAudioTap;
}

/**
 * Returns whether this build can capture the local participant's speech at all.
 *
 * Whether it can capture it right now is a further question the native side answers, because a host application which
 * supplies its own audio device module leaves nothing to attach the tap to.
 *
 * @returns {boolean}
 */
export function isLiveTranscribeSupported(): boolean {
    return Boolean(getLocalAudioTapNativeModule()?.start);
}
