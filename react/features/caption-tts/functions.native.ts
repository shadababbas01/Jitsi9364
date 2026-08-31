import { NativeModules, Platform } from 'react-native';

import { ITtsVoice } from './types';

export * from './functions.any';

const { CaptionsTTS } = NativeModules;

export interface ICaptionsTtsNativeModule {
    getAvailableLanguages: () => Promise<string[]>;

    /**
     * The voices the engine has for a language, or for every language when asked for an empty one. Absent on a device
     * running an SDK from before speakers were told apart by voice, so callers check for it.
     */
    getVoices?: (language: string) => Promise<ITtsVoice[]>;
    initialize: () => Promise<boolean>;
    isLanguageAvailable: (language: string) => Promise<boolean>;
    shutdown: () => void;
    speak: (text: string, language: string, rate: number) => Promise<boolean>;

    /**
     * Speaks in a named voice, at a pitch. A name the engine does not know is not an error: it speaks in the voice it
     * would have chosen itself. Absent on an older SDK, exactly as {@link getVoices} is.
     */
    speakAs?: (
        text: string, language: string, rate: number, voiceName: string | null, pitch: number) => Promise<boolean>;
    stop: () => void;
    synthesizeToFile: (text: string, language: string, rate: number, fileName: string) => Promise<string>;
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
