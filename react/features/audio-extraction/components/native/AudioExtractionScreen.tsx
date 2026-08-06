/* eslint-disable react/no-multi-comp, @typescript-eslint/naming-convention, @stylistic/padding-line-between-statements, @stylistic/indent, react/jsx-indent, react/jsx-sort-props, react/jsx-no-bind, react/jsx-max-props-per-line */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    DeviceEventEmitter,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';
import Sound from 'react-native-sound';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getConferenceName } from '../../../base/conference/functions';
import { getCaptionsTtsNativeModule } from '../../../caption-tts/functions.native';
import {
    MELP_TRANSCRIBE_URL,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_MODE
} from '../../../live-transcribe/constants';
import {
    MELP_SPEECH_ERROR_EVENT,
    MELP_SPEECH_FINAL_EVENT,
    MELP_SPEECH_PARTIAL_EVENT,
    getLocalMicRecorderNativeModule,
    getMelpCryptoNativeModule,
    getMelpSpeechRecognizerNativeModule,
    getMelpTranscriptionBridgeNativeModule
} from '../../functions.native';

import styles from './styles';

// const MELP_STATIC_AUDIO_URL = 'https://us-api.melp.us/download/v0/86q0rufzol4w/bnn81rlj0ef4.mp3?sessionid=eyJhbGciOiJIUzI1NiJ9.eyJ2ZXIiOiJmdDEiLCJmZWF0dXJlVG9rZW4iOiIiLCJpYXQiOjE3ODU4NzM3MjAsImV4cCI6MTc4ODQ2NTcyMH0.sjkdRAV_xto5xcoVdezwOMkKrb0WknVmnZQhXcKdlTA&isenc=0';
// const MELP_STATIC_SESSION_ID = 'eyJhbGciOiJIUzI1NiJ9.eyJ2ZXIiOiJmdDEiLCJmZWF0dXJlVG9rZW4iOiIiLCJpYXQiOjE3ODU4NzM3MjAsImV4cCI6MTc4ODQ2NTcyMH0.sjkdRAV_xto5xcoVdezwOMkKrb0WknVmnZQhXcKdlTA';

const WINDOW_DURATION_MS = 10_000;
const MELP_FILE_UPLOAD_URL = 'https://us-api.melp.us/files/upload/v3';
const MELP_STATIC_SESSION_ID = 'eyJhbGciOiJIUzI1NiJ9.eyJ2ZXIiOiJmdDEiLCJmZWF0dXJlVG9rZW4iOiIiLCJpYXQiOjE3ODYwMDg2NDMsImV4cCI6MTc4ODYwMDY0M30.eCmnU5Td41S_zGnQ9Y9xp1cNwXxpzE4fotc-S1v5WHY';

/**
 * The encrypted email the upload endpoint identifies the caller by, byte for byte as the Melp app's own upload/v3
 * request carries it. The leading slash is part of the base64 ciphertext, not a separator: without it the value is 43
 * characters and cannot decode to the 32 bytes the service expects.
 */
const MELP_STATIC_ENCRYPTED_EMAIL = '/gXvESKF7P+VqYmH4mSQCxtQQs3ay2hto8It+M3dS20=';
const MELP_UPLOAD_DECRYPTION_KEY = '0eca2ed5f67e686c272f0ec2b5f9e622187880db6ff1149607d209a3782675ab';

/**
 * What the upload is told about encryption. The Melp app sends {@code 0} here even though the email itself is
 * encrypted, so the answer comes back as plain JSON.
 */
const MELP_UPLOAD_ISENC = '0';
const MELP_UPLOAD_TYPE = '1';
const DEFAULT_CONVERSATION_ID = 'audio-extraction';

/**
 * How long the final on-device result is waited for after the window closes. The recogniser is still chewing through
 * the tail of the pipe when the recording stops, but a clip must not sit there waiting on it either.
 */
const FINAL_RESULT_GRACE_MS = 1_500;

interface Clip {
    audioSource: string;
    endedAt: number;
    id: string;
    index: number;

    /**
     * What the device itself heard while the window was being recorded. Kept even once the Melp transcript replaces it
     * on screen, so a later failure can fall back to it.
     */
    localTranscript: string;
    startedAt: number;
    transcript: string;

    /**
     * Where {@link transcript} came from, so the UI can say whether it is the service's word or the device's.
     */
    transcriptSource: 'device' | 'melp' | 'pending';
}

type ClipCardProps = {
    clip: Clip;
    onPlayClip: (clip: Clip) => void;
    onShowClip: (clipId: string) => void;
};

function ClipCard({ clip, onPlayClip, onShowClip }: ClipCardProps) {
    const handlePlay = useCallback(() => {
        onShowClip(clip.id);
        onPlayClip(clip);
    }, [ clip, onPlayClip, onShowClip ]);

    const handleShow = useCallback(() => {
        onShowClip(clip.id);
    }, [ clip.id, onShowClip ]);

    return (
        <View style = { styles.clipCard }>
            <Text style = { styles.clipTitle }>
                Clip { clip.index + 1 }
            </Text>
            <Text style = { styles.path }>
                { formatClockLabel(clip.startedAt) } - { formatClockLabel(clip.endedAt) }
            </Text>
            <Text style = { styles.clipTranscript }>
                { clip.transcript }
            </Text>
            <Text style = { styles.path }>
                { clip.transcriptSource === 'device'
                    ? 'Heard on this device'
                    : clip.transcriptSource === 'melp' ? 'Transcribed by Melp' : 'Waiting for Melp' }
            </Text>
            <Text style = { styles.path }>
                { clip.audioSource }
            </Text>
            <View style = { styles.buttonRow }>
                <Pressable
                    onPress = { handlePlay }
                    style = { styles.actionButton }>
                    <Text style = { styles.actionButtonText }>
                        Play WAV
                    </Text>
                </Pressable>
                <Pressable
                    onPress = { handleShow }
                    style = { styles.secondaryButton }>
                    <Text style = { styles.secondaryButtonText }>
                        Show text
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

function formatClockLabel(timestamp: number) {
    const date = new Date(timestamp);
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${minutes}:${seconds}`;
}

function toFileUri(path: string) {
    return path.startsWith('file://') ? path : `file://${path}`;
}

function getFileNameFromPath(path: string) {
    const normalized = path.replace(/^file:\/\//, '');

    return normalized.split('/').pop() || 'recording.wav';
}

function buildAudioUrlWithQuery(baseUrl: string, sessionId: string) {
    const url = new URL(baseUrl);

    if (!url.searchParams.get('sessionid')) {
        url.searchParams.append('sessionid', sessionId);
    }

    // Always 1, so the URL comes out in the shape the download endpoint is called with even when the upload answered
    // with something else.
    url.searchParams.set('isenc', '1');

    return url.toString();
}

function extractFileUrl(payload: any): string {
    const candidate = payload?.fileurl
        ?? payload?.file_url
        ?? payload?.url
        ?? payload?.data?.fileurl
        ?? payload?.data?.file_url
        ?? payload?.data?.url
        ?? payload?.result?.fileurl
        ?? payload?.result?.file_url
        ?? payload?.result?.url
        ?? (typeof payload?.data === 'string' ? (() => {
            try {
                const parsed = JSON.parse(payload.data);

                return parsed?.fileurl ?? parsed?.file_url ?? parsed?.url ?? parsed?.result?.fileurl ?? parsed?.result?.file_url ?? parsed?.result?.url;
            } catch (error) {
                return undefined;
            }
        })() : undefined);

    return typeof candidate === 'string' ? candidate.trim() : '';
}

function buildUploadRequestPreview(audioPath: string, conversationId: string) {
    return [
        `POST ${MELP_FILE_UPLOAD_URL}`,
        `email=${MELP_STATIC_ENCRYPTED_EMAIL}`,
        `sessionid=${MELP_STATIC_SESSION_ID}`,
        `isenc=${MELP_UPLOAD_ISENC}`,
        `file=${getFileNameFromPath(audioPath)}`,
        `conversationid=${conversationId}`,
        `type=${MELP_UPLOAD_TYPE}`
    ].join('\n');
}

function parsePossiblyEncryptedJson(rawResponse: string): any {
    try {
        return JSON.parse(rawResponse);
    } catch (error) {
        return rawResponse;
    }
}

type Decryptor = (input: string, key: string, algo: string) => Promise<string | null>;

/**
 * Recovers the file URL from an upload response which came back encrypted. The service answers in the clear for
 * {@code isenc=0}, so this only earns its keep when it does not; the ciphertext arrives either as a bare base64 body
 * or wrapped in a JSON envelope.
 *
 * @param {any} payload - The parsed response body, or the raw body when it is not JSON.
 * @param {string} rawResponse - The response body as it arrived.
 * @param {Decryptor} decrypt - The crypto bridge, absent when it is not available on this platform.
 * @returns {Promise<string>} The file URL, or an empty string when none could be recovered.
 */
async function decryptFileUrl(payload: any, rawResponse: string, decrypt?: Decryptor): Promise<string> {
    const candidate = typeof payload === 'string'
        ? payload
        : payload?.data ?? payload?.encdata ?? payload?.encryptedData ?? payload?.result;
    const ciphertext = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : rawResponse.trim();

    if (!ciphertext || !decrypt) {
        return '';
    }

    try {
        const decrypted = (await decrypt(ciphertext, MELP_UPLOAD_DECRYPTION_KEY, 'AES'))?.trim();

        if (!decrypted) {
            return '';
        }

        return extractFileUrl(parsePossiblyEncryptedJson(decrypted))
            || (/^https?:\/\//i.test(decrypted) ? decrypted : '');
    } catch (error) {
        console.warn('[audio-extraction] could not decrypt the upload api response', { error });

        return '';
    }
}

type UploadResult = {
    fileUrl: string;
    payload: any;
    rawResponse: string;
};

async function uploadAudioFile(
    audioPath: string,
    conversationId: string,
    decrypt: Decryptor | undefined,
    onPreview: (value: string) => void,
    onRawResponse: (value: string) => void
): Promise<UploadResult> {
    const body = new FormData();
    const email = MELP_STATIC_ENCRYPTED_EMAIL;
    const sessionId = MELP_STATIC_SESSION_ID;
    const fileUri = toFileUri(audioPath);
    const fileName = getFileNameFromPath(audioPath);
    const requestPreview = buildUploadRequestPreview(audioPath, conversationId);

    onPreview(requestPreview);

    // The field order mirrors the Melp app's own upload/v3 request.
    body.append('email', email);
    body.append('sessionid', sessionId);
    body.append('isenc', MELP_UPLOAD_ISENC);
    body.append('file', {
        name: fileName,
        type: 'audio/wav',
        uri: fileUri
    } as any);
    body.append('conversationid', conversationId);
    body.append('type', MELP_UPLOAD_TYPE);

    console.info('[audio-extraction] upload request started', {
        audioPath,
        conversationId,
        email,
        fileName
    });

    const response = await fetch(MELP_FILE_UPLOAD_URL, {
        body,
        headers: {
            Accept: 'application/json'
        },
        method: 'POST'
    }).catch(error => {
        onRawResponse(`Upload request failed: ${String(error)}`);
        throw error;
    });

    const rawResponse = await response.text();

    onRawResponse(rawResponse);

    if (!response.ok) {
        console.warn('[audio-extraction] upload api returned a failure status', {
            audioPath,
            conversationId,
            email,
            rawResponse,
            status: response.status
        });
        throw new Error(`Upload API returned ${response.status}`);
    }

    const payload = parsePossiblyEncryptedJson(rawResponse);
    const fileUrl = extractFileUrl(payload) || await decryptFileUrl(payload, rawResponse, decrypt);

    if (!fileUrl) {
        console.warn('[audio-extraction] upload api response did not include a file url', {
            audioPath,
            conversationId,
            email,
            payload,
            rawResponse
        });
        throw new Error('Upload API did not return a file url');
    }

    const fileUrlWithQuery = buildAudioUrlWithQuery(fileUrl, sessionId);

    // Put the URL the transcription is about to be asked for next to the request which produced it.
    onPreview([
        requestPreview,
        '',
        `audio_url=${fileUrlWithQuery}`
    ].join('\n'));

    console.info('[audio-extraction] upload request succeeded', {
        audioPath,
        conversationId,
        email,
        fileUrl: fileUrlWithQuery
    });

    return {
        fileUrl: fileUrlWithQuery,
        payload,
        rawResponse
    };
}

function parseTranscription(payload: any): string {
    const candidate = payload?.transcription
        ?? payload?.text
        ?? payload?.transcript
        ?? payload?.data?.transcription
        ?? payload?.data?.text
        ?? payload?.data?.transcript
        ?? payload?.results?.[0]?.transcription
        ?? payload?.results?.[0]?.text
        ?? payload?.results?.[0]?.transcript
        ?? (Array.isArray(payload) ? payload?.[0]?.transcription : undefined);

    return typeof candidate === 'string' ? candidate.trim() : '';
}

async function transcribeAudioFile(audioUrl: string, messageId: string): Promise<string> {
    const body = new FormData();

    body.append('audio_url', audioUrl);
    body.append('mode', TRANSCRIBE_MODE);
    body.append('message_id', messageId);
    body.append('language', TRANSCRIBE_LANGUAGE);

    console.info('[audio-extraction] transcription request started', {
        audioUrl,
        messageId
    });

    const response = await fetch(MELP_TRANSCRIBE_URL, {
        body,
        headers: {
            Accept: 'application/json'
        },
        method: 'POST'
    });

    if (!response.ok) {
        console.warn('[audio-extraction] transcription api returned a failure status', {
            audioUrl,
            messageId,
            status: response.status
        });
        throw new Error(`Transcription API returned ${response.status}`);
    }

    const rawResponse = await response.text();

    let payload: any;

    try {
        payload = JSON.parse(rawResponse);
    } catch (error) {
        console.warn('[audio-extraction] transcription api returned non-json response', {
            audioUrl,
            messageId,
            rawResponse
        });
        throw new Error('Transcription API returned a non-JSON response');
    }
    const status = typeof payload?.status === 'string'
        ? payload.status
        : typeof payload?.results?.[0]?.status === 'string'
            ? payload.results[0].status
            : undefined;
    const transcription = parseTranscription(payload);
    const errorMessage = typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.error === 'string'
            ? payload.error
            : typeof payload?.results?.[0]?.error === 'string'
                ? payload.results[0].error
                : undefined;

    if ((status && status !== 'success') || !transcription) {
        console.warn('[audio-extraction] transcription api returned an empty or failed payload', {
            audioUrl,
            messageId,
            rawResponse,
            payload,
            status,
            transcription
        });
        throw new Error(errorMessage || 'No transcription returned');
    }

    console.info('[audio-extraction] transcription request succeeded', {
        audioUrl,
        messageId,
        transcription
    });

    return transcription;
}

async function readTranscriptionAloud(text: string): Promise<void> {
    const tts = getCaptionsTtsNativeModule();

    if (!tts) {
        console.warn('[audio-extraction] text to speech bridge is not available');

        return;
    }

    try {
        await tts.initialize();
        await tts.speak(text, 'en-US', 1);
        console.info('[audio-extraction] read aloud succeeded', { text });
    } catch (error) {
        console.warn('[audio-extraction] read aloud failed', {
            error,
            text
        });
    }
}

function HeaderMenuButton({ onPress }: { onPress: () => void; }) {
    return (
        <Pressable
            accessibilityLabel = 'Audio extraction overflow menu'
            onPress = { onPress }
            style = { styles.menuButton }>
            <Text style = { styles.menuButtonText }>
                ⋮
            </Text>
        </Pressable>
    );
}

export default function AudioExtractionScreen() {
    const navigation = useNavigation();
    const conversationId = useSelector((state: IReduxState) => getConferenceName(state) || DEFAULT_CONVERSATION_ID);
    const melpCrypto = getMelpCryptoNativeModule();
    const melpBridge = getMelpTranscriptionBridgeNativeModule();
    const decryptUpload: Decryptor | undefined = melpCrypto
        ? (input, key, algo) => melpCrypto.decryptString(input, key, algo)
        : undefined;
    const [ clips, setClips ] = useState<Clip[]>([]);
    const [ status, setStatus ] = useState('Ready to record 10-second microphone windows.');
    const [ menuVisible, setMenuVisible ] = useState(false);
    const [ activeClipId, setActiveClipId ] = useState<string | null>(null);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ uploadRequestPreview, setUploadRequestPreview ] = useState('');
    const [ uploadApiResponse, setUploadApiResponse ] = useState('');
    const [ uploadResolvedFileUrl, setUploadResolvedFileUrl ] = useState('');
    const [ liveTranscript, setLiveTranscript ] = useState('');
    const [ speechSupported, setSpeechSupported ] = useState<boolean | null>(null);
    const recorderModuleRef = useRef(getLocalMicRecorderNativeModule());
    const speechModuleRef = useRef(getMelpSpeechRecognizerNativeModule());
    const speechSupportedRef = useRef<boolean | null>(null);
    const liveTranscriptRef = useRef('');
    const finalResultResolveRef = useRef<(() => void) | null>(null);
    const captureRunningRef = useRef(false);
    const clipCountRef = useRef(0);
    const soundRef = useRef<Sound | null>(null);

    const activeClip = activeClipId == null
        ? clips[0]
        : clips.find(clip => clip.id === activeClipId) || clips[0];

    const openMenu = useCallback(() => {
        setMenuVisible(true);
    }, []);

    const closeMenu = useCallback(() => {
        setMenuVisible(false);
    }, []);

    // The recogniser talks back through device events, so its text lands in a ref the capture loop can read
    // synchronously as well as in state for rendering.
    useEffect(() => {
        const subscriptions = [
            DeviceEventEmitter.addListener(MELP_SPEECH_PARTIAL_EVENT, ({ text }: { text: string; }) => {
                liveTranscriptRef.current = text;
                setLiveTranscript(text);
            }),
            DeviceEventEmitter.addListener(MELP_SPEECH_FINAL_EVENT, ({ text }: { text: string; }) => {
                if (text) {
                    liveTranscriptRef.current = text;
                    setLiveTranscript(text);
                }

                finalResultResolveRef.current?.();
            }),
            DeviceEventEmitter.addListener(MELP_SPEECH_ERROR_EVENT, ({ text }: { text: string; }) => {
                console.warn('[audio-extraction] on-device recognition reported an error', { text });
                finalResultResolveRef.current?.();
            })
        ];

        return () => subscriptions.forEach(subscription => subscription.remove());
    }, []);

    /**
     * Opens a recognition session for the window which is about to be recorded. The recogniser reads the recorder's
     * samples through a pipe, so this has to be running before the first of them is captured.
     */
    const startLocalRecognition = useCallback(async () => {
        const speech = speechModuleRef.current;

        if (!speech) {
            return;
        }

        if (speechSupportedRef.current === null) {
            speechSupportedRef.current = await speech.isSupported().catch(() => false);
            setSpeechSupported(speechSupportedRef.current);
        }

        if (!speechSupportedRef.current) {
            return;
        }

        liveTranscriptRef.current = '';
        setLiveTranscript('');

        try {
            await speech.start(WINDOW_DURATION_MS);
        } catch (error) {
            console.warn('[audio-extraction] could not start on-device recognition', { error });
        }
    }, []);

    /**
     * Closes the session and gives the recogniser a moment to finish the tail of the audio it was handed.
     *
     * @returns {Promise<string>} What the device heard, empty when it heard nothing usable.
     */
    const finishLocalRecognition = useCallback(async () => {
        const speech = speechModuleRef.current;

        if (!speech || !speechSupportedRef.current) {
            return '';
        }

        const finalResult = new Promise<void>(resolve => {
            finalResultResolveRef.current = resolve;
        });

        try {
            await speech.stop();
        } catch (error) {
            console.warn('[audio-extraction] could not stop on-device recognition', { error });
        }

        await Promise.race([
            finalResult,
            new Promise<void>(resolve => {
                setTimeout(resolve, FINAL_RESULT_GRACE_MS);
            })
        ]);

        finalResultResolveRef.current = null;

        return liveTranscriptRef.current.trim();
    }, []);

    const captureNextClip = useCallback(async () => {
        if (!captureRunningRef.current) {
            return;
        }

        const module = recorderModuleRef.current;

        if (!module) {
            setStatus('Microphone recorder is not available on this device.');
            captureRunningRef.current = false;

            return;
        }

        const startedAt = Date.now();
        const index = clipCountRef.current;
        const safeId = `${startedAt}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        setStatus(`Recording clip ${index + 1} from microphone...`);

        try {
            await startLocalRecognition();

            const audioSource = await module.recordToFile(`audio-extraction-${safeId}.wav`, WINDOW_DURATION_MS);
            const endedAt = Date.now();
            const localTranscript = await finishLocalRecognition();

            if (!captureRunningRef.current) {
                return;
            }

            const clip: Clip = {
                audioSource,
                endedAt,
                id: `${startedAt}-${index}`,
                index,
                localTranscript,
                startedAt,

                // The device already heard this window, so it is shown straight away and the Melp transcript takes its
                // place when it arrives.
                transcript: localTranscript || 'Transcribing...',
                transcriptSource: localTranscript ? 'device' : 'pending'
            };

            clipCountRef.current = index + 1;
            setClips(prev => [ clip, ...prev ]);
            setActiveClipId(clip.id);
            setStatus(`Saved clip ${index + 1} to device storage.`);
            void (async () => {
                try {
                    if (melpBridge?.transcribeAudioFile) {
                        try {
                            const bridgeResult: any = await melpBridge.transcribeAudioFile(audioSource, clip.id, conversationId);

                            if (bridgeResult?.transcription) {
                                setUploadRequestPreview(bridgeResult.uploadRequestPreview || 'Handled by the Melp app bridge.');
                                setUploadApiResponse(bridgeResult.uploadApiResponse || '');
                                setUploadResolvedFileUrl(bridgeResult.resolvedFileUrl || bridgeResult.fileUrl || '');
                                setClips(prev => prev.map(item => (
                                    item.id === clip.id
                                        ? {
                                            ...item,
                                            transcript: bridgeResult.transcription,
                                            transcriptSource: 'melp'
                                        }
                                        : item
                                )));
                                void readTranscriptionAloud(bridgeResult.transcription);
                                setStatus(`Transcription complete for clip ${index + 1}.`);
                                return;
                            }
                        } catch (bridgeError) {
                            console.warn('[audio-extraction] Melp bridge transcription failed, falling back to local upload', {
                                audioPath: audioSource,
                                conversationId,
                                error: bridgeError
                            });
                        }
                    }

                    const uploadResult = await uploadAudioFile(
                        audioSource,
                        conversationId,
                        decryptUpload,
                        setUploadRequestPreview,
                        setUploadApiResponse
                    );

                    setUploadResolvedFileUrl(uploadResult.fileUrl);

                    const transcription = await transcribeAudioFile(uploadResult.fileUrl, clip.id);

                    if (!captureRunningRef.current && !transcription) {
                        return;
                    }

                    setClips(prev => prev.map(item => (
                        item.id === clip.id
                            ? {
                                ...item,
                                transcript: transcription,
                                transcriptSource: 'melp'
                            }
                            : item
                    )));
                    void readTranscriptionAloud(transcription);
                    setStatus(`Transcription complete for clip ${index + 1}.`);
                } catch (error) {
                    console.warn('[audio-extraction] transcription request failed', {
                        audioPath: audioSource,
                        conversationId,
                        email: MELP_STATIC_ENCRYPTED_EMAIL,
                        localTranscript: clip.localTranscript,
                        messageId: clip.id,
                        error
                    });

                    // The service is out, but the device already heard this window. Keep what it heard rather than
                    // throwing the clip away.
                    setClips(prev => prev.map(item => (
                        item.id === clip.id
                            ? {
                                ...item,
                                transcript: item.localTranscript || 'Transcription failed.',
                                transcriptSource: item.localTranscript ? 'device' : 'pending'
                            }
                            : item
                    )));

                    if (clip.localTranscript) {
                        void readTranscriptionAloud(clip.localTranscript);
                        setStatus(`Melp transcription failed for clip ${index + 1}; using the on-device transcript.`);
                    } else {
                        setStatus(`Transcription failed for clip ${index + 1}.`);
                    }
                }
            })();

            if (captureRunningRef.current) {
                void captureNextClip();
            }
        } catch (error) {
            captureRunningRef.current = false;
            console.warn('[audio-extraction] microphone recording failed', {
                audioPath: `audio-extraction-${safeId}.wav`,
                error,
                messageId: `${startedAt}-${index}`
            });
            setStatus('Failed to record microphone audio.');
        }
    }, []);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <HeaderMenuButton onPress = { openMenu } />
        });
    }, [ navigation, openMenu ]);

    useEffect(() => {
        captureRunningRef.current = true;
        setStatus('Recording first 10-second microphone window...');
        void captureNextClip();

        return () => {
            captureRunningRef.current = false;
            recorderModuleRef.current?.stop();
            speechModuleRef.current?.stop().catch(() => undefined);
            soundRef.current?.release();
            soundRef.current = null;
        };
    }, [ captureNextClip ]);

    const showLatestTranscript = () => {
        closeMenu();
        if (clips[0]) {
            setActiveClipId(clips[0].id);
            setStatus('Showing latest transcript.');
        }
    };

    const clearSession = () => {
        closeMenu();
        captureRunningRef.current = false;
        recorderModuleRef.current?.stop();

        setClips([]);
        clipCountRef.current = 0;
        setActiveClipId(null);
        setIsPlaying(false);
        soundRef.current?.release();
        soundRef.current = null;
        setStatus('Session cleared.');
    };

    const resumeSession = () => {
        closeMenu();
        if (captureRunningRef.current) {
            setStatus('Capture is already running.');

            return;
        }

        captureRunningRef.current = true;
        setStatus('Recording first 10-second microphone window...');
        void captureNextClip();
    };

    const playClip = useCallback((clip: Clip) => {
        soundRef.current?.release();
        soundRef.current = null;
        setIsPlaying(true);
        setStatus(`Loading clip ${clip.index + 1} WAV...`);

        const sound = new Sound(clip.audioSource, '', error => {
            if (error) {
                setIsPlaying(false);
                setStatus('Failed to load WAV file.');

                return;
            }

            soundRef.current = sound;
            setStatus(`Playing clip ${clip.index + 1} WAV.`);
            sound.play(success => {
                setIsPlaying(false);
                setStatus(success ? `Clip ${clip.index + 1} playback finished.` : 'Playback failed.');
            });
        });
    }, []);

    const stopPlayback = useCallback(() => {
        soundRef.current?.stop(() => {
            soundRef.current?.release();
            soundRef.current = null;
        });
        setIsPlaying(false);
        setStatus('Playback stopped.');
    }, []);

    const playLatestClip = useCallback(() => {
        if (!activeClip) {
            return;
        }

        playClip(activeClip);
    }, [ activeClip ]);

    const selectClip = useCallback((clipId: string) => {
        setActiveClipId(clipId);
    }, []);

    return (
        <View style = { styles.screen }>
            <ScrollView contentContainerStyle = { styles.container }>
                <Text style = { styles.title }>
                    Audio Extraction
                </Text>
                <Text style = { styles.subtitle }>
                    The screen records one 10-second microphone window at a time, saves each clip as a WAV file, and transcribes it with the Melp API.
                </Text>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Current status
                    </Text>
                    <Text style = { styles.status }>
                        { status }
                    </Text>
                    <Text style = { styles.path }>
                        Window length: 10s
                    </Text>
                    <Text style = { styles.path }>
                        Recorded clips: { clips.length }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Live on-device transcript
                    </Text>
                    <Text style = { styles.transcript }>
                        { liveTranscript || 'Listening...' }
                    </Text>
                    <Text style = { styles.path }>
                        { speechSupported === false
                            ? 'On-device recognition is unavailable here, so clips rely on the Melp API alone.'
                            : 'Written as you speak, from the same microphone samples the clip is recorded from.' }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Latest transcript
                    </Text>
                    <Text style = { styles.transcript }>
                        { activeClip?.transcript || 'Waiting for the first 10-second window to finish.' }
                    </Text>
                    <Text style = { styles.path }>
                        { activeClip ? `Clip ${activeClip.index + 1} | ${formatClockLabel(activeClip.startedAt)} - ${formatClockLabel(activeClip.endedAt)}` : 'No clip selected yet.' }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Saved audio
                    </Text>
                    <Text style = { styles.path }>
                        Each clip is stored as a WAV file in app cache on this device.
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Upload request
                    </Text>
                    <Text style = { styles.path }>
                        { uploadRequestPreview || 'No upload request captured yet.' }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Upload API response
                    </Text>
                    <Text style = { styles.path }>
                        { uploadApiResponse || 'No upload response captured yet.' }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Resolved file URL
                    </Text>
                    <Text style = { styles.path }>
                        { uploadResolvedFileUrl || 'No file URL resolved yet.' }
                    </Text>
                </View>

                <View style = { styles.summaryCard }>
                    <Text style = { styles.sectionTitle }>
                        Upload field notes
                    </Text>
                    <Text style = { styles.path }>
                        { `Encrypted email (the only identity sent): ${MELP_STATIC_ENCRYPTED_EMAIL}` }
                    </Text>
                    <Text style = { styles.path }>
                        { `isenc=${MELP_UPLOAD_ISENC}, type=${MELP_UPLOAD_TYPE}, conversationid=${conversationId}` }
                    </Text>
                    <Text style = { styles.path }>
                        { 'Local recording is still WAV. The curl sample uses MP3, so format conversion is still needed for an exact match.' }
                    </Text>
                </View>

                <Text style = { styles.sectionTitle }>
                    Recorded clips
                </Text>
                <View>
                    { clips.map(item => (
                        <ClipCard
                            key = { item.id }
                            clip = { item }
                            onPlayClip = { playClip }
                            onShowClip = { selectClip } />
                    )) }
                </View>
                <View style = { styles.buttonRow }>
                    <Pressable
                        onPress = { playLatestClip }
                        style = { styles.actionButton }>
                        <Text style = { styles.actionButtonText }>
                            { isPlaying ? 'Playing' : 'Play latest WAV' }
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress = { stopPlayback }
                        style = { styles.secondaryButton }>
                        <Text style = { styles.secondaryButtonText }>
                            Stop
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>

                <Modal
                    animationType = 'fade'
                    onRequestClose = { closeMenu }
                    transparent = { true }
                    visible = { menuVisible }>
                    <Pressable
                        onPress = { closeMenu }
                        style = { styles.modalBackdrop }>
                        <Pressable
                            onPress = { closeMenu }
                            style = { styles.menuSheet }>
                            <Text style = { styles.menuSheetTitle }>
                                Audio extraction
                            </Text>
                            <Pressable
                                onPress = { showLatestTranscript }
                                style = { styles.menuItem }>
                                <Text style = { styles.menuItemText }>
                                    Show latest transcript
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress = { resumeSession }
                                style = { styles.menuItem }>
                                <Text style = { styles.menuItemText }>
                                    Resume 10-second capture
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress = { clearSession }
                                style = { styles.menuItem }>
                                <Text style = { styles.menuItemText }>
                                    Clear clips
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress = { closeMenu }
                                style = { styles.menuItem }>
                                <Text style = { styles.menuItemText }>
                                    Close
                                </Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>
            </View>
        );
}
