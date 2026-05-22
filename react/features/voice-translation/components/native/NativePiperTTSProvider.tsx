import React, {
    Dispatch,
    SetStateAction,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { NativeModules, Platform } from 'react-native';
import Sound from 'react-native-sound';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translateLiveCaptionText } from '../../../subtitles/languages';
import { setTileView } from '../../../video-layout/actions.any';
import { setParticipantTranslating } from '../../actions';
import { DEFAULT_PIPER_TTS_URL } from '../../constants';
import logger from '../../logger';

interface ISynthesisRequest {
    language?: string;
    messageId?: string;
    needsTranslation?: boolean;
    participantId?: string;
    sourceLanguage?: string;
    text: string;
}

export interface IVoiceOption {
    id: string;
    placeholder: string;
}

interface IPlaybackItem {
    data: string;
    format: string;
    request?: ISynthesisRequest;
}

interface INativePiperTTSContextValue {
    enabled: boolean;
    isConnected: boolean;
    isConnecting: boolean;
    isPlaying: boolean;
    languages: IVoiceOption[];
    lastError: string | null;
    requestSynthesisForParticipant: (request: ISynthesisRequest) => void;
    setEnabled: Dispatch<SetStateAction<boolean>>;
}

declare global {
    // eslint-disable-next-line no-var
    var __melp_tts_request__: ((request: ISynthesisRequest) => void) | undefined;
}

const NativePiperTTSContext = createContext<INativePiperTTSContextValue | undefined>(undefined);
const { OpenMelpModule } = NativeModules;

function buildWsUrlWithJwt(baseUrl: string, jwt?: string | null) {
    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}token=${encodeURIComponent(jwt || 'abc123')}`;
}

function normalizeLanguages(input: any): IVoiceOption[] {
    if (!input) {
        return [];
    }

    if (Array.isArray(input)) {
        return input
            .map(item => {
                if (typeof item === 'string') {
                    return {
                        id: item,
                        placeholder: item.replace(/_/g, '-')
                    };
                }

                return {
                    id: item?.id ?? String(item),
                    placeholder: item?.placeholder ?? item?.name ?? String(item?.id ?? item)
                };
            })
            .filter(item => item.id);
    }

    if (typeof input === 'object') {
        return Object.values(input).map((item: any) => ({
            id: item?.id ?? String(item),
            placeholder: item?.placeholder ?? item?.name ?? String(item?.id ?? item)
        }));
    }

    return [];
}

function sameLanguages(first: IVoiceOption[], second: IVoiceOption[]) {
    if (first.length !== second.length) {
        return false;
    }

    return first.every((item, index) =>
        item.id === second[index].id && item.placeholder === second[index].placeholder);
}

function audioMimeType(format: string) {
    return format === 'wav' ? 'audio/wav' : `audio/${format || 'wav'}`;
}

function toDataUri(data: string, format: string) {
    if (data.startsWith('data:')) {
        return data;
    }

    return `data:${audioMimeType(format)};base64,${data}`;
}

function playAudioPayload(
        data: string,
        format: string,
        fallbackSoundRef: React.MutableRefObject<Sound | null>): Promise<number> {
    if (Platform.OS === 'ios' && OpenMelpModule?.playVoiceTranslationAudio) {
        return OpenMelpModule.playVoiceTranslationAudio(data, format)
            .then((result: { duration?: number; } = {}) => Number(result.duration) || 0);
    }

    return new Promise<number>(resolve => {
        const sound = new Sound(toDataUri(data, format), undefined, error => {
            if (error) {
                logger.warn('Failed to load voice translation audio', error);
                sound.release();
                resolve(0);

                return;
            }

            fallbackSoundRef.current = sound;
            const duration = sound.getDuration();

            sound.play(() => {
                sound.release();

                if (fallbackSoundRef.current === sound) {
                    fallbackSoundRef.current = null;
                }
            });
            resolve(duration);
        });
    });
}

/**
 * Native Piper TTS websocket provider.
 *
 * @param {Object} props - Component props.
 * @returns {React.ReactElement}
 */
export function NativePiperTTSProvider({ children }: { children: React.ReactNode; }) {
    const dispatch = useDispatch();
    const jwt = useSelector((state: IReduxState) => state['features/base/jwt'].jwt);
    const voiceTranslationEnabled = useSelector(
        (state: IReduxState) => Boolean(state['features/voice-translation']?.enabled)
    );
    const voiceTranslationPopupOpen = useSelector(
        (state: IReduxState) => Boolean(state['features/voice-translation']?.showPreferencesPopup)
    );
    const [ languages, setLanguages ] = useState<IVoiceOption[]>([]);
    const [ isConnected, setIsConnected ] = useState(false);
    const [ isConnecting, setIsConnecting ] = useState(false);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const [ lastError, setLastError ] = useState<string | null>(null);
    const [ manualEnabled, setManualEnabled ] = useState(false);
    const [ enabled, setEnabledState ] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const enabledRef = useRef(false);
    const isConnectingRef = useRef(false);
    const queuedRequests = useRef<ISynthesisRequest[]>([]);
    const pendingRequests = useRef<ISynthesisRequest[]>([]);
    const playbackQueue = useRef<IPlaybackItem[]>([]);
    const isPlayingRef = useRef(false);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
    const playbackTimer = useRef<ReturnType<typeof setTimeout>>();
    const currentParticipantRef = useRef<string | null>(null);
    const fallbackSoundRef = useRef<Sound | null>(null);

    const stopCurrentPlayback = useCallback(() => {
        if (playbackTimer.current) {
            clearTimeout(playbackTimer.current);
            playbackTimer.current = undefined;
        }

        const participantId = currentParticipantRef.current;

        if (participantId) {
            dispatch(setParticipantTranslating(participantId, false));
        }

        if (Platform.OS === 'ios' && OpenMelpModule?.stopVoiceTranslationAudio) {
            OpenMelpModule.stopVoiceTranslationAudio();
        }

        fallbackSoundRef.current?.stop();
        fallbackSoundRef.current?.release();
        fallbackSoundRef.current = null;
        currentParticipantRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
    }, [ dispatch ]);

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = undefined;
        }

        wsRef.current?.close();
        wsRef.current = null;
        isConnectingRef.current = false;
        setIsConnecting(false);
        setIsConnected(false);
    }, []);

    const playNextInQueue = useCallback(() => {
        if (!enabledRef.current || isPlayingRef.current) {
            return;
        }

        const item = playbackQueue.current.shift();

        if (!item) {
            return;
        }

        const participantId = item.request?.participantId;

        isPlayingRef.current = true;
        currentParticipantRef.current = participantId || null;
        setIsPlaying(true);

        if (participantId) {
            dispatch(setParticipantTranslating(participantId, true));
        }

        playAudioPayload(item.data, item.format, fallbackSoundRef)
            .then((duration: number) => {
                const waitMs = Math.max(500, Math.ceil(duration * 1000) + 250);

                playbackTimer.current = setTimeout(() => {
                    stopCurrentPlayback();
                    playNextInQueue();
                }, waitMs);
            })
            .catch((error: unknown) => {
                logger.warn('Voice translation playback failed', error);
                stopCurrentPlayback();
                playNextInQueue();
            });
    }, [ dispatch, stopCurrentPlayback ]);

    const sendSynthesisOverSocket = useCallback((request: ISynthesisRequest, ws: WebSocket) => {
        const language = request.language || languages[0]?.id || '';

        if (!language || !request.text?.trim()) {
            return false;
        }

        pendingRequests.current.push(request);
        ws.send(JSON.stringify({
            type: 'synthesize',
            text: request.text,
            language
        }));

        return true;
    }, [ languages ]);

    const flushQueue = useCallback(() => {
        const ws = wsRef.current;

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        while (queuedRequests.current.length) {
            const request = queuedRequests.current[0];

            if (!sendSynthesisOverSocket(request, ws)) {
                break;
            }

            queuedRequests.current.shift();
        }
    }, [ sendSynthesisOverSocket ]);

    const connectRef = useRef<() => void>(() => undefined);

    const connect = useCallback(() => {
        if (!enabledRef.current || wsRef.current || isConnectingRef.current) {
            return;
        }

        isConnectingRef.current = true;
        setIsConnecting(true);
        setLastError(null);

        try {
            const ws = new WebSocket(buildWsUrlWithJwt(DEFAULT_PIPER_TTS_URL, jwt));

            wsRef.current = ws;

            ws.onopen = () => {
                if (!enabledRef.current) {
                    ws.close();

                    return;
                }

                isConnectingRef.current = false;
                setIsConnecting(false);
                setIsConnected(true);
                setLastError(null);
                flushQueue();
            };

            ws.onmessage = event => {
                try {
                    const payload = JSON.parse(String(event.data));

                    if (payload.type === 'languages' || payload.type === 'voices') {
                        const nextLanguages = normalizeLanguages(payload.languages || payload.voices)
                            .sort((a, b) => (a.placeholder || a.id).localeCompare(b.placeholder || b.id));

                        setLanguages(current => sameLanguages(current, nextLanguages) ? current : nextLanguages);

                        return;
                    }

                    if (payload.type === 'audio') {
                        const request = pendingRequests.current.shift();

                        if (payload.data) {
                            playbackQueue.current.push({
                                data: payload.data,
                                format: payload.format || 'wav',
                                request
                            });
                            playNextInQueue();
                        }

                        return;
                    }

                    if (payload.type === 'error') {
                        pendingRequests.current.shift();
                        setLastError(payload.message || 'Voice translation failed');
                    }
                } catch (error) {
                    logger.warn('Failed to parse Piper TTS message', error);
                }
            };

            ws.onerror = () => {
                if (enabledRef.current) {
                    setLastError('Connection error');
                }

                try {
                    ws.close();
                } catch (_) {
                    // Already closed.
                }
            };

            ws.onclose = () => {
                wsRef.current = null;
                isConnectingRef.current = false;
                setIsConnecting(false);
                setIsConnected(false);

                if (pendingRequests.current.length) {
                    queuedRequests.current = [
                        ...pendingRequests.current,
                        ...queuedRequests.current
                    ];
                    pendingRequests.current = [];
                }

                if (enabledRef.current) {
                    reconnectTimer.current = setTimeout(() => connectRef.current(), 5000);
                }
            };
        } catch (error) {
            logger.warn('Failed to connect to Piper TTS', error);
            isConnectingRef.current = false;
            setIsConnecting(false);
            setLastError(error instanceof Error ? error.message : 'Connection error');
        }
    }, [ flushQueue, jwt, playNextInQueue ]);

    useEffect(() => {
        connectRef.current = connect;
    }, [ connect ]);

    const enqueueRequest = useCallback(async (request: ISynthesisRequest) => {
        if (!request.text?.trim()) {
            return;
        }

        let text = request.text;

        if (request.needsTranslation && request.language) {
            try {
                text = await translateLiveCaptionText(request.text, request.language, jwt);
            } catch (error) {
                logger.warn('Voice translation text translation failed', error);
            }
        }

        if (!enabledRef.current || !text?.trim()) {
            return;
        }

        queuedRequests.current.push({
            ...request,
            needsTranslation: false,
            text
        });

        const ws = wsRef.current;

        if (ws?.readyState === WebSocket.OPEN) {
            flushQueue();
        } else {
            connectRef.current();
        }
    }, [ flushQueue, jwt ]);

    const requestSynthesisForParticipant = useCallback((request: ISynthesisRequest) => {
        void enqueueRequest(request);
    }, [ enqueueRequest ]);

    const setEnabled = useCallback((value: SetStateAction<boolean>) => {
        setManualEnabled(current => {
            return typeof value === 'function'
                ? (value as (previous: boolean) => boolean)(current)
                : value;
        });
    }, []);

    const shouldEnable = voiceTranslationEnabled || voiceTranslationPopupOpen || manualEnabled;

    useEffect(() => {
        if (shouldEnable && !enabled) {
            setEnabledState(true);
        } else if (!shouldEnable && enabled) {
            setEnabledState(false);
        }
    }, [ shouldEnable, enabled ]);

    useEffect(() => {
        if (voiceTranslationEnabled) {
            dispatch(setTileView(true));
        }
    }, [ dispatch, voiceTranslationEnabled ]);

    useEffect(() => {
        enabledRef.current = enabled;

        if (enabled) {
            connectRef.current();
        } else {
            disconnect();
            queuedRequests.current = [];
            pendingRequests.current = [];
            playbackQueue.current = [];
            stopCurrentPlayback();
            setLastError(null);
        }
    }, [ disconnect, enabled, stopCurrentPlayback ]);

    useEffect(() => {
        globalThis.__melp_tts_request__ = requestSynthesisForParticipant;

        return () => {
            if (globalThis.__melp_tts_request__ === requestSynthesisForParticipant) {
                globalThis.__melp_tts_request__ = undefined;
            }
        };
    }, [ requestSynthesisForParticipant ]);

    useEffect(() => () => {
        enabledRef.current = false;
        disconnect();
        stopCurrentPlayback();
    }, [ disconnect, stopCurrentPlayback ]);

    const value = useMemo<INativePiperTTSContextValue>(() => ({
        enabled,
        isConnected,
        isConnecting,
        isPlaying,
        languages,
        lastError,
        requestSynthesisForParticipant,
        setEnabled
    }), [
        enabled,
        isConnected,
        isConnecting,
        isPlaying,
        languages,
        lastError,
        requestSynthesisForParticipant,
        setEnabled
    ]);

    return (
        <NativePiperTTSContext.Provider value = { value }>
            { children }
        </NativePiperTTSContext.Provider>
    );
}

/**
 * Returns native Piper TTS context.
 *
 * @returns {INativePiperTTSContextValue}
 */
export function useNativePiperTTS() {
    const context = useContext(NativePiperTTSContext);

    if (!context) {
        throw new Error('useNativePiperTTS must be used within NativePiperTTSProvider');
    }

    return context;
}
