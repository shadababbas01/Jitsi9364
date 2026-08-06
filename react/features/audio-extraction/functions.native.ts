import { NativeModules, Platform } from 'react-native';

const { LocalMicRecorder } = NativeModules;
const { MelpCrypto } = NativeModules;
const { MelpAudioTranscriptionBridge } = NativeModules;
const { MelpSpeechRecognizer } = NativeModules;

/**
 * The events the on-device recogniser emits while a session is running.
 */
export const MELP_SPEECH_PARTIAL_EVENT = 'melpSpeechPartialResult';
export const MELP_SPEECH_FINAL_EVENT = 'melpSpeechFinalResult';
export const MELP_SPEECH_ERROR_EVENT = 'melpSpeechError';

export interface ILocalMicRecorderNativeModule {
    recordToFile: (fileName: string, durationMs: number) => Promise<string>;
    stop: () => void;
}

export interface IMelpCryptoNativeModule {
    decryptString: (input: string, key: string, algo: string) => Promise<string | null>;
}

export interface IMelpAudioTranscriptionBridgeResult {
    fileUrl?: string;
    resolvedFileUrl?: string;
    transcription?: string;
    uploadApiResponse?: string;
    uploadDecryptedFileUrl?: string;
    uploadDecryptedResponse?: string;
    uploadDecryptionError?: string;
    uploadEncryptedData?: string;
    uploadRequestPreview?: string;
}

export interface IMelpAudioTranscriptionBridgeNativeModule {
    transcribeAudioFile: (
        audioPath: string,
        messageId: string,
        conversationId?: string,
    ) => Promise<IMelpAudioTranscriptionBridgeResult | null>;
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

export function getMelpCryptoNativeModule(): IMelpCryptoNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return MelpCrypto;
}

export function getMelpTranscriptionBridgeNativeModule(): IMelpAudioTranscriptionBridgeNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    return MelpAudioTranscriptionBridge;
}
