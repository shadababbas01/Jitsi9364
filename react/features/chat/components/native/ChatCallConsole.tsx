/* eslint-disable react/no-multi-comp */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    DeviceEventEmitter,
    Easing,
    Pressable,
    Text,
    TextStyle,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import {
    IMelpUtterance,
    MELP_UTTERANCE_READY_EVENT,
    MELP_UTTERANCE_SPEECH_STATE_EVENT,
    getLocalMicRecorderNativeModule
} from '../../../audio-extraction/functions.native';
import Icon from '../../../base/icons/components/Icon';
import { IconMessage, IconMic, IconMicSlash, IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import { getCaptionsTtsNativeModule, isChatTtsEnabled, isReadingAloud } from '../../../caption-tts/functions.native';
import { wasRecentlySpoken } from '../../../caption-tts/spokenText';
import transcribeWavFile from '../../../live-transcribe/native/transcribeWav';
import { sendMessage } from '../../actions.native';

import { ChatCallContext } from './ChatCallContext';
import ChatInputBar from './ChatInputBar';
import { chatCallStyles as styles } from './styles';

/**
 * How long a pause ends an utterance and sends it off to be transcribed.
 */
const SILENCE_MS = 1000;

/**
 * The longest the recorder waits for a pause before handing an utterance over anyway, so that a monologue is still
 * transcribed as it goes rather than at the end.
 */
const MAX_UTTERANCE_MS = 20 * 1000;

/**
 * How long to wait for the transcription service. Longer than the caption default because a whole utterance is a bigger
 * upload than a fixed caption window.
 */
const TRANSCRIBE_TIMEOUT_MS = 60 * 1000;

/**
 * How long the microphone stays deaf after the device has stopped speaking. A room reverberates, and the last syllable
 * out of the loudspeaker is still in the air after the engine reports it done.
 */
const ECHO_TAIL_MS = 400;

/**
 * How many bars the level meter is drawn with.
 */
const WAVEFORM_BARS = 7;

/**
 * A level meter following the voice: the recorder reports when it starts and stops hearing speech, and the bars move
 * while it does.
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
 * The console of the live translation call. The microphone is open the whole time this screen is on: the recorder cuts
 * what is said at every pause and hands each utterance over, which is transcribed and sent to everyone in the call as a
 * chat message without anybody having to press anything. The single microphone button here stops and resumes that; the
 * conference microphone stays muted for as long as the screen is open, so nothing is said twice.
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
    const readingAloud = useSelector((state: IReduxState) => isReadingAloud(state));

    const recorderRef = useRef(getLocalMicRecorderNativeModule());
    const ttsRef = useRef(getCaptionsTtsNativeModule());
    const canRecord = Boolean(recorderRef.current?.startUtteranceSession);
    const canReadAloud = Boolean(ttsRef.current?.speak);

    const [ listening, setListening ] = useState(canRecord);
    const [ speaking, setSpeaking ] = useState(false);
    const [ deafened, setDeafened ] = useState(false);
    const [ pending, setPending ] = useState(0);
    const [ notice, setNotice ] = useState('');

    const mountedRef = useRef(true);
    const halo = useRef(new Animated.Value(1)).current;

    // Utterances are transcribed one after the other, so what is said first is also sent first.
    const chainRef = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => () => {
        mountedRef.current = false;
        recorderRef.current?.stopUtteranceSession();
        setDictating(false);
    }, []);

    // The stage above draws the local avatar speaking while the recorder hears a voice.
    useEffect(() => {
        setDictating(speaking);
    }, [ setDictating, speaking ]);

    const transcribeAndSend = useCallback(async (utterance: IMelpUtterance) => {
        const fileName = utterance.path.split('/').pop() || 'utterance.wav';

        if (mountedRef.current) {
            setPending(count => count + 1);
        }

        try {
            const transcript = await transcribeWavFile(utterance.path, fileName, TRANSCRIBE_TIMEOUT_MS);

            // The backstop to deafening the microphone: what leaked through the gate is the device hearing its own
            // voice, and sending it back would have the other side read it out and echo it to us in turn.
            if (transcript && wasRecentlySpoken(transcript)) {
                return;
            }

            if (transcript) {
                dispatch(sendMessage(transcript));

                if (mountedRef.current) {
                    setNotice('');
                }
            }
        } catch (error) {
            if (mountedRef.current) {
                setNotice(t('chat.voice.failed'));
            }
        } finally {
            // Leaving the screen does not abandon an utterance: it is still transcribed and sent, there is just no
            // console left to say so.
            if (mountedRef.current) {
                setPending(count => Math.max(0, count - 1));
            }
        }
    }, [ dispatch, t ]);

    // Each utterance the recorder hands over is transcribed and sent while the microphone carries on listening.
    useEffect(() => {
        const utteranceSubscription = DeviceEventEmitter.addListener(
            MELP_UTTERANCE_READY_EVENT,
            (utterance: IMelpUtterance) => {
                if (!utterance?.path) {
                    return;
                }

                chainRef.current = chainRef.current
                    .then(() => transcribeAndSend(utterance))
                    .catch(() => { /* Already reported; the chain must survive it. */ });
            });
        const speechSubscription = DeviceEventEmitter.addListener(
            MELP_UTTERANCE_SPEECH_STATE_EVENT,
            (event: { speaking?: boolean; }) => setSpeaking(Boolean(event?.speaking)));

        return () => {
            utteranceSubscription.remove();
            speechSubscription.remove();
        };
    }, [ transcribeAndSend ]);

    // Deafens the microphone for as long as the device is speaking, plus a tail for the room. This is what stops the
    // text-to-speech voice from being recorded back in, transcribed, and sent to the meeting as if it had been said.
    useEffect(() => {
        const recorder = recorderRef.current;

        if (!recorder?.setUtteranceSessionMuted) {
            return;
        }

        if (readingAloud) {
            recorder.setUtteranceSessionMuted(true);
            setDeafened(true);
            setSpeaking(false);

            return;
        }

        const timeout = setTimeout(() => {
            recorder.setUtteranceSessionMuted(false);

            if (mountedRef.current) {
                setDeafened(false);
            }
        }, ECHO_TAIL_MS);

        return () => clearTimeout(timeout);
    }, [ readingAloud ]);

    // Opens and closes the microphone to match the button.
    useEffect(() => {
        const recorder = recorderRef.current;

        if (!recorder || !canRecord) {
            return;
        }

        if (!listening) {
            recorder.stopUtteranceSession();
            setSpeaking(false);

            return;
        }

        recorder.startUtteranceSession(SILENCE_MS, MAX_UTTERANCE_MS)
            .catch(() => {
                if (mountedRef.current) {
                    setNotice(t('chat.voice.unavailable'));
                    setListening(false);
                }
            });
    }, [ canRecord, listening, t ]);

    // Breathes the ring around the microphone button while a voice is being heard.
    useEffect(() => {
        if (!speaking) {
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
    }, [ halo, speaking ]);

    const toggleListening = useCallback(() => {
        setNotice('');
        setListening(value => !value);
    }, []);

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

    if (!canRecord) {
        stateLine = (
            <Text style = { styles.hintText as TextStyle }>
                { t('chat.voice.unavailable') }
            </Text>
        );
    } else if (deafened) {
        stateLine = (
            <Text
                numberOfLines = { 1 }
                style = { styles.hintText as TextStyle }>
                { t('chat.call.pausedWhileReading') }
            </Text>
        );
    } else if (speaking) {
        stateLine = (
            <>
                <View style = { styles.liveDot as ViewStyle } />
                <Text style = { styles.stateText as TextStyle }>
                    { t('chat.call.youAreSpeaking') }
                </Text>
            </>
        );
    } else if (pending > 0) {
        stateLine = (
            <Text style = { styles.stateText as TextStyle }>
                { t('chat.call.sending') }
            </Text>
        );
    } else {
        stateLine = (
            <Text
                numberOfLines = { 1 }
                style = { styles.hintText as TextStyle }>
                { notice || t(listening ? 'chat.call.listeningForSpeech' : 'chat.call.micIsOff') }
            </Text>
        );
    }

    return (
        <View style = { styles.console as ViewStyle }>
            <View style = { styles.stateRow as ViewStyle }>
                { stateLine }
            </View>

            <Waveform active = { speaking } />

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
                                { readAloud ? t('chat.call.sound') : t('chat.call.muted') }
                            </Text>
                        </>
                    ) }
                </View>

                <Pressable
                    accessibilityLabel = { t(listening ? 'chat.call.micOff' : 'chat.call.micOn') }
                    accessibilityRole = 'button'
                    disabled = { !canRecord }
                    onPress = { toggleListening }
                    style = { [
                        styles.talkButton,
                        speaking && styles.talkButtonRecording,
                        (!canRecord || !listening) && styles.talkButtonDisabled
                    ] as ViewStyle[] }>
                    { speaking && (
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
                        src = { listening ? IconMic : IconMicSlash } />
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
