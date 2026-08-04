import { NativeModules, Platform } from 'react-native';

const { LocalMicRecorder } = NativeModules;

export interface ILocalMicRecorderNativeModule {
    recordToFile: (fileName: string, durationMs: number) => Promise<string>;
    stop: () => void;
}

export function getLocalMicRecorderNativeModule(): ILocalMicRecorderNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return LocalMicRecorder;
}
