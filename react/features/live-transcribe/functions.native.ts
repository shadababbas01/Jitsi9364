import { getLocalMicRecorderNativeModule } from '../audio-extraction/functions.native';

export * from './functions.any';

/**
 * Returns whether this build can capture the local participant's speech at all.
 *
 * Captions are produced by the native utterance-session recorder, so this asks after the recorder which provides it.
 * It is only wired up on Android for now.
 *
 * @returns {boolean}
 */
export function isLiveTranscribeSupported(): boolean {
    const recorder = getLocalMicRecorderNativeModule();

    return Boolean(recorder?.startUtteranceSession && recorder?.stopUtteranceSession);
}
