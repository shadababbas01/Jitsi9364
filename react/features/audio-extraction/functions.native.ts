import { NativeModules, Platform } from 'react-native';

const { LocalMicRecorder } = NativeModules;
const { MelpSpeechRecognizer } = NativeModules;

/**
 * The events the on-device recogniser emits while a session is running.
 */
export const MELP_SPEECH_PARTIAL_EVENT = 'melpSpeechPartialResult';
export const MELP_SPEECH_FINAL_EVENT = 'melpSpeechFinalResult';
export const MELP_SPEECH_ERROR_EVENT = 'melpSpeechError';

/**
 * Emitted by the recorder once an utterance from a continuous session has been written to disk.
 */
export const MELP_UTTERANCE_READY_EVENT = 'melpUtteranceReady';

/**
 * Emitted by the recorder whenever a continuous session starts or stops hearing speech.
 */
export const MELP_UTTERANCE_SPEECH_STATE_EVENT = 'melpUtteranceSpeechState';

export interface IMelpUtterance {

    /**
     * Whether this utterance opens with the last moment of the one before it, because the recorder cut a speaker who
     * had not paused. The words the two share have to come back out of the text.
     */
    continuesPrevious?: boolean;
    durationMs: number;
    index: number;
    path: string;
}

export interface ILocalMicRecorderNativeModule {

    /**
     * Deletes a recording, once whatever transcribed it is finished with it. Nothing waits on it.
     */
    deleteFile: (path: string) => void;

    /**
     * Reads a recorded WAV back as Base64, so that it can be put on the transcription socket as one text frame.
     * JavaScript cannot read a file off the disk on its own, and this module is the one which wrote it.
     */
    readFileAsBase64: (path: string) => Promise<string>;

    recordToFile: (fileName: string, durationMs: number) => Promise<string>;

    /**
     * Deafens the running session without closing the microphone, so that what the device says out loud is not heard
     * back and transcribed.
     */
    setUtteranceSessionMuted: (muted: boolean) => void;

    /**
     * Tells the running session that this device is reading something out of its own loudspeaker, which raises the bar
     * for starting a new utterance without ever stopping the recording.
     */
    setUtteranceSessionPlaybackActive: (active: boolean) => void;

    /**
     * Keeps the microphone open and reports one utterance per pause through {@link MELP_UTTERANCE_READY_EVENT}.
     */
    startUtteranceSession: (silenceMs: number, maxUtteranceMs: number) => Promise<boolean>;
    stop: () => void;
    stopUtteranceSession: () => void;
}

export interface IMelpSpeechRecognizerNativeModule {
    isSupported: () => Promise<boolean>;
    start: (windowMs: number) => Promise<boolean>;
    stop: () => Promise<boolean>;
}

export function getMelpSpeechRecognizerNativeModule(): IMelpSpeechRecognizerNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return MelpSpeechRecognizer;
}

export function getLocalMicRecorderNativeModule(): ILocalMicRecorderNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return LocalMicRecorder;
}
