/* eslint-disable react/no-multi-comp, @typescript-eslint/naming-convention, @stylistic/padding-line-between-statements, @stylistic/indent, react/jsx-indent, react/jsx-sort-props, react/jsx-no-bind, react/jsx-max-props-per-line */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';
import Sound from 'react-native-sound';

import { getCaptionsTtsNativeModule } from '../../../caption-tts/functions.native';
import { getLocalMicRecorderNativeModule } from '../../functions.native';
import styles from './styles';

const WINDOW_DURATION_MS = 10_000;
const TRANSCRIBE_URL = 'https://ai.live.melp.us:5001/transcribe/text';

interface Clip {
    audioSource: string;
    endedAt: number;
    id: string;
    index: number;
    startedAt: number;
    transcript: string;
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

async function transcribeWavFile(audioPath: string): Promise<string> {
    const body = new FormData();
    body.append('audio', {
        uri: toFileUri(audioPath),
        name: getFileNameFromPath(audioPath),
        type: 'audio/wav',
    } as any);
    body.append('mode', 'transcribe');
    body.append('language', 'en');

    console.info('[audio-extraction] transcription request started', {
        audioPath
    });

    const response = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn('[audio-extraction] transcription api returned a failure status', {
            audioPath,
            status: response.status,
            errorText
        });
        throw new Error(`Transcription API returned ${response.status}`);
    }

    const transcription = await response.text();
    console.info('[audio-extraction] transcription request succeeded', {
        audioPath,
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
    const [ clips, setClips ] = useState<Clip[]>([]);
    const [ status, setStatus ] = useState('Ready to record 10-second microphone windows.');
    const [ menuVisible, setMenuVisible ] = useState(false);
    const [ activeClipId, setActiveClipId ] = useState<string | null>(null);
    const [ isPlaying, setIsPlaying ] = useState(false);
    const recorderModuleRef = useRef(getLocalMicRecorderNativeModule());
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
            const audioSource = await module.recordToFile(`audio-extraction-${safeId}.wav`, WINDOW_DURATION_MS);
            const endedAt = Date.now();

            if (!captureRunningRef.current) {
                return;
            }

            const clip: Clip = {
                audioSource,
                endedAt,
                id: `${startedAt}-${index}`,
                index,
                startedAt,
                transcript: 'Transcribing...'
            };

            clipCountRef.current = index + 1;
            setClips(prev => [ clip, ...prev ]);
            setActiveClipId(clip.id);
            setStatus(`Saved clip ${index + 1}. Transcribing...`);

            try {
                const transcription = await transcribeWavFile(audioSource);

                setClips(prev => prev.map(item =>
                    item.id === clip.id
                        ? { ...item, transcript: transcription.trim() }
                        : item
                ));
                void readTranscriptionAloud(transcription);
                setStatus(`Transcription complete for clip ${index + 1}.`);

            } catch (error) {
                console.warn('[audio-extraction] transcription request failed', {
                    audioPath: audioSource,
                    error
                });
                setClips(prev => prev.map(item =>
                    item.id === clip.id
                        ? { ...item, transcript: 'Transcription failed.' }
                        : item
                ));
                setStatus(`Transcription failed for clip ${index + 1}.`);
            }

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
                    The screen records one 10-second microphone window at a time, saves each clip as a WAV file, and transcribes it.
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
                        Latest transcript
                    </Text>
                    <Text style = { styles.transcript }>
                        { activeClip?.transcript || 'Waiting for the first 10-second window to finish.' }
                    </Text>
                    <Text style = { styles.path }>
                        { activeClip ? `Clip ${activeClip.index + 1} | ${formatClockLabel(activeClip.startedAt)} - ${formatClockLabel(activeClip.endedAt)}` : 'No clip selected yet.' }
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
