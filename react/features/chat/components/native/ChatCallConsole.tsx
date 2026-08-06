/* eslint-disable react/no-multi-comp */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getLocalMicRecorderNativeModule } from '../../../audio-extraction/functions.native';
import Icon from '../../../base/icons/components/Icon';
import { IconMessage, IconMic, IconStop, IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import { getCaptionsTtsNativeModule, isChatTtsEnabled } from '../../../caption-tts/functions.native';
import transcribeWavFile from '../../../live-transcribe/native/transcribeWav';
import { sendMessage } from '../../actions.native';

import { ChatCallContext } from './ChatCallContext';
import ChatInputBar from './ChatInputBar';
import { chatCallStyles as styles } from './styles';

/**
 * The longest single utterance we record. The native recorder takes a duration up front and stops early when asked, so
 * this is only a backstop for a recording nobody ever stopped.
 */
const MAX_RECORDING_MS = 2 * 60 * 1000;

/**
 * How long to wait for the transcription service. Longer than the caption default because a whole utterance is a bigger
 * upload than a fixed caption window.
 */
const TRANSCRIBE_TIMEOUT_MS = 60 * 1000;

/**
 * How many bars the level meter is drawn with.
 */
const WAVEFORM_BARS = 7;

type VoiceState = 'idle' | 'recording' | 'transcribing';

/**
 * Formats an elapsed duration as {@code m:ss}.
 *
 * @param {number} elapsedMs - How long the recording has been running.
 * @returns {string}
 */
function formatElapsed(elapsedMs: number) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');

    return `${minutes}:${seconds}`;
}

/**
 * A level meter standing in for the open microphone. The bars are animated rather than driven by the real signal: the
 * recorder writes its samples straight to a file without reporting levels back, and a meter which merely says "the
 * microphone is live" is what this has to convey.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
function Waveform({ active }: { active: boolean; }) {
    const scales = useMemo(
        () => Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(0.3)),
        []);

    useEffect(() => {
        if (!active) {
            scales.forEach(scale => scale.setValue(0.3));

            return;
        }

        // Each bar runs at its own pace, so the meter ripples instead of pulsing as one block.
        const animations = scales.map((scale, index) => {
            const duration = 320 + (index % 3) * 110;

            return Animated.loop(Animated.sequence([
                Animated.timing(scale, {
                    duration,
                    easing: Easing.inOut(Easing.ease),
                    toValue: 1,
                    useNativeDriver: true
                }),
                Animated.timing(scale, {
                    duration,
                    easing: Easing.inOut(Easing.ease),
                    toValue: 0.3,
                    useNativeDriver: true
                })
            ]));
        });

        animations.forEach((animation, index) => setTimeout(() => animation.start(), index * 70));

        return () => animations.forEach(animation => animation.stop());
    }, [ active, scales ]);

    return (
        <View style = { styles.waveform as ViewStyle }>
            { scales.map((scale, index) => (
                <Animated.View
                    key = { index }
                    style = { [
                        styles.waveformBar,
                        !active && styles.waveformBarIdle,
                        { transform: [ { scaleY: scale } ] }
                    ] as ViewStyle[] } />
            )) }
        </View>
    );
}

/**
 * The console of the live translation call: it records what the local participant says, sends the transcript to everyone
 * as a chat message, and carries the switch for reading incoming messages aloud. Reading them out is done by the
 * caption-tts chat middleware wherever in the app the local user is, so this only turns it on and off.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element | null}
 */
function ChatCallConsole({ inputVisible, onToggleInput }: {
    inputVisible: boolean;
    onToggleInput: () => void;
}) {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { setDictating } = useContext(ChatCallContext);
    const readAloud = useSelector((state: IReduxState) => isChatTtsEnabled(state));

    const [ voiceState, setVoiceState ] = useState<VoiceState>('idle');
    const [ elapsedMs, setElapsedMs ] = useState(0);
    const [ notice, setNotice ] = useState('');

    const recorderRef = useRef(getLocalMicRecorderNativeModule());
    const ttsRef = useRef(getCaptionsTtsNativeModule());
    const startedAtRef = useRef(0);
    const cancelledRef = useRef(false);
    const mountedRef = useRef(true);
    const halo = useRef(new Animated.Value(1)).current;

    const canRecord = Boolean(recorderRef.current?.recordToFile);
    const canReadAloud = Boolean(ttsRef.current?.speak);
    const isRecording = voiceState === 'recording';
    const isBusy = voiceState === 'transcribing';

    // The stage above draws the local avatar speaking while the microphone is open.
    useEffect(() => {
        setDictating(isRecording);
    }, [ isRecording, setDictating ]);

    // Leaving the screen only stops the microphone: a message being read out carries on, since read aloud is not tied to
    // the chat being open.
    useEffect(() => () => {
        mountedRef.current = false;
        cancelledRef.current = true;
        recorderRef.current?.stop();
        setDictating(false);
    }, []);

    // Keeps the elapsed counter ticking for as long as the microphone is open.
    useEffect(() => {
        if (!isRecording) {
            return;
        }

        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startedAtRef.current);
        }, 250);

        return () => clearInterval(interval);
    }, [ isRecording ]);

    // Breathes the ring around the microphone button while it is open.
    useEffect(() => {
        if (!isRecording) {
            halo.setValue(1);

            return;
        }

        const animation = Animated.loop(Animated.sequence([
            Animated.timing(halo, {
                duration: 900,
                easing: Easing.out(Easing.ease),
                toValue: 1.35,
                useNativeDriver: true
            }),
            Animated.timing(halo, {
                duration: 900,
                easing: Easing.in(Easing.ease),
                toValue: 1,
                useNativeDriver: true
            })
        ]));

        animation.start();

        return () => animation.stop();
    }, [ halo, isRecording ]);

    const startRecording = useCallback(() => {
        const recorder = recorderRef.current;

        if (!recorder) {
            return;
        }

        cancelledRef.current = false;
        startedAtRef.current = Date.now();
        setElapsedMs(0);
        setNotice('');
        setVoiceState('recording');

        // Nothing should talk over the participant while they are dictating.
        ttsRef.current?.stop();

        const fileName = `chat-voice-${startedAtRef.current}.wav`;

        recorder.recordToFile(fileName, MAX_RECORDING_MS)
            .then(async audioPath => {
                if (cancelledRef.current) {
                    return;
                }

                if (mountedRef.current) {
                    setVoiceState('transcribing');
                }

                const transcript = await transcribeWavFile(audioPath, fileName, TRANSCRIBE_TIMEOUT_MS);

                if (cancelledRef.current) {
                    return;
                }

                if (!transcript) {
                    if (mountedRef.current) {
                        setNotice(t('chat.voice.nothingHeard'));
                        setVoiceState('idle');
                    }

                    return;
                }

                dispatch(sendMessage(transcript));

                if (mountedRef.current) {
                    setNotice('');
                    setVoiceState('idle');
                }
            })
            .catch(() => {
                if (mountedRef.current && !cancelledRef.current) {
                    setNotice(t('chat.voice.failed'));
                    setVoiceState('idle');
                }
            });
    }, [ dispatch, t ]);

    // Asking the recorder to stop makes it resolve with whatever it captured so far, which is then transcribed.
    const toggleRecording = useCallback(() => {
        if (isRecording) {
            recorderRef.current?.stop();

            return;
        }

        if (voiceState === 'idle') {
            startRecording();
        }
    }, [ isRecording, startRecording, voiceState ]);

    const toggleReadAloud = useCallback(() => {
        if (readAloud) {
            // Turning it off also silences whatever is being read out at that moment.
            ttsRef.current?.stop();
        }

        dispatch(updateSettings({ readChatAloud: !readAloud }));
    }, [ dispatch, readAloud ]);

    if (!canRecord && !canReadAloud) {
        return null;
    }

    let stateLine;

    if (isRecording) {
        stateLine = (
            <>
                <View style = { styles.liveDot as ViewStyle } />
                <Text style = { styles.stateText as TextStyle }>
                    { t('chat.voice.speaking') }
                </Text>
                <Text style = { styles.elapsedText as TextStyle }>
                    { formatElapsed(elapsedMs) }
                </Text>
            </>
        );
    } else if (isBusy) {
        stateLine = (
            <Text style = { styles.stateText as TextStyle }>
                { t('chat.voice.transcribing') }
            </Text>
        );
    } else {
        stateLine = (
            <Text
                numberOfLines = { 1 }
                style = { styles.hintText as TextStyle }>
                { notice || (canRecord ? t('chat.voice.hint') : t('chat.voice.unavailable')) }
            </Text>
        );
    }

    return (
        <View style = { styles.console as ViewStyle }>
            <View style = { styles.stateRow as ViewStyle }>
                { stateLine }
            </View>

            <Waveform active = { isRecording } />

            <View style = { styles.controlsRow as ViewStyle }>
                <View style = { styles.sideControl as ViewStyle }>
                    { canReadAloud && (
                        <>
                            <Pressable
                                accessibilityLabel = { t('chat.voice.readAloud') }
                                accessibilityRole = 'button'
                                onPress = { toggleReadAloud }
                                style = { [
                                    styles.roundControl,
                                    readAloud && styles.roundControlOn
                                ] as ViewStyle[] }>
                                <Icon
                                    color = '#FFFFFF'
                                    size = { 20 }
                                    src = { readAloud ? IconVolumeUp : IconVolumeOff } />
                            </Pressable>
                            <Text style = { styles.controlLabel as TextStyle }>
                                { readAloud ? t('chat.call.listening') : t('chat.call.muted') }
                            </Text>
                        </>
                    ) }
                </View>

                <Pressable
                    accessibilityLabel = { isRecording ? t('chat.voice.stop') : t('chat.voice.start') }
                    accessibilityRole = 'button'
                    disabled = { !canRecord || isBusy }
                    onPress = { toggleRecording }
                    style = { [
                        styles.talkButton,
                        isRecording && styles.talkButtonRecording,
                        (!canRecord || isBusy) && styles.talkButtonDisabled
                    ] as ViewStyle[] }>
                    { isRecording && (
                        <Animated.View
                            pointerEvents = 'none'
                            style = { [
                                styles.talkButtonHalo,
                                { transform: [ { scale: halo } ] }
                            ] as ViewStyle[] } />
                    ) }
                    <Icon
                        color = '#FFFFFF'
                        size = { 30 }
                        src = { isRecording ? IconStop : IconMic } />
                </Pressable>

                <View style = { styles.sideControl as ViewStyle }>
                    <Pressable
                        accessibilityLabel = { t('chat.call.type') }
                        accessibilityRole = 'button'
                        onPress = { onToggleInput }
                        style = { [
                            styles.roundControl,
                            inputVisible && styles.roundControlOn
                        ] as ViewStyle[] }>
                        <Icon
                            color = '#FFFFFF'
                            size = { 20 }
                            src = { IconMessage } />
                    </Pressable>
                    <Text style = { styles.controlLabel as TextStyle }>
                        { t('chat.call.type') }
                    </Text>
                </View>
            </View>
        </View>
    );
}

/**
 * The bottom of the live translation call: the console, plus the text field for typing a message instead of speaking it,
 * which stays out of the way until it is asked for.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
export default function ChatCallFooter({ onSend }: { onSend: (text: string) => void; }) {
    const [ inputVisible, setInputVisible ] = useState(false);

    const toggleInput = useCallback(() => {
        setInputVisible(visible => !visible);
    }, []);

    return (
        <>
            { inputVisible && <ChatInputBar onSend = { onSend } /> }
            <ChatCallConsole
                inputVisible = { inputVisible }
                onToggleInput = { toggleInput } />
        </>
    );
}
