import { getLocalMicRecorderNativeModule } from '../audio-extraction/functions.native';

export * from './functions.any';

/**
 * Returns whether this build can capture the local participant's speech at all.
 *
 * Captions are produced by recording the microphone in fixed windows, so this asks after the recorder which does that.
 * It is only wired up on Android for now.
 *
 * @returns {boolean}
 */
export function isLiveTranscribeSupported(): boolean {
    return Boolean(getLocalMicRecorderNativeModule()?.recordToFile);
}
