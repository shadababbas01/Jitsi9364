import { NativeModules, Platform } from 'react-native';

export * from './functions.any';

const { CaptionsTTS } = NativeModules;

export interface ICaptionsTtsNativeModule {
    getAvailableLanguages: () => Promise<string[]>;
    initialize: () => Promise<boolean>;
    isLanguageAvailable: (language: string) => Promise<boolean>;
    shutdown: () => void;
    speak: (text: string, language: string, rate: number) => Promise<boolean>;
    stop: () => void;
}

/**
 * Returns the device text-to-speech bridge, if this platform has one. Reading captions aloud is Android only for now.
 *
 * @returns {ICaptionsTtsNativeModule | undefined}
 */
export function getCaptionsTtsNativeModule(): ICaptionsTtsNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return CaptionsTTS;
}

/**
 * Returns whether captions can be read aloud on this device.
 *
 * @returns {boolean}
 */
export function isCaptionTtsSupported(): boolean {
    return Boolean(getCaptionsTtsNativeModule()?.speak);
}
