/* eslint-disable react/no-multi-comp */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { getLocalMicRecorderNativeModule } from '../../../audio-extraction/functions.native';
import Icon from '../../../base/icons/components/Icon';
import { IconMessage, IconMic, IconMicSlash, IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import { getCaptionsTtsNativeModule, isChatTtsEnabled, isReadingAloud } from '../../../caption-tts/functions.native';
import { setLiveTranslationActive, setLiveTranslationMic } from '../../../live-translation/actions';
import { getLiveTranslationState } from '../../../live-translation/functions.native';

import { ChatCallContext } from './ChatCallContext';
import ChatInputBar from './ChatInputBar';
import { chatCallStyles as styles } from './styles';

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
 * The console of the live translation call as seen from the chat screen. Recording, transcription and sending are done
 * by the live-translation middleware, which is the single engine behind both this and the panel over the video: two
 * recorders would send everything twice. This turns that engine on when the screen is opened and reflects its state.
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

    const readAloud = useSelector(isChatTtsEnabled);
    const readingAloud = useSelector(isReadingAloud);
    const { active, dictating, error, micOn, pending } = useSelector(getLiveTranslationState);

    const ttsRef = useRef(getCaptionsTtsNativeModule());
    const halo = useRef(new Animated.Value(1)).current;

    const canRecord = Boolean(getLocalMicRecorderNativeModule()?.startUtteranceSession);
    const canReadAloud = Boolean(ttsRef.current?.speak);

    // Opening this screen is asking for the translated call. Leaving it does not end the call, since the panel over the
    // video is the same call and may well be why it was turned on in the first place.
    useEffect(() => {
        if (!active && canRecord) {
            dispatch(setLiveTranslationActive(true));
        }
    }, []);

    // The stage above draws the local avatar speaking while the recorder hears a voice.
    useEffect(() => {
        setDictating(dictating);
    }, [ dictating, setDictating ]);

    // Breathes the ring around the microphone button while a voice is being heard.
    useEffect(() => {
        if (!dictating) {
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
    }, [ dictating, halo ]);

    const toggleListening = useCallback(() => {
        dispatch(setLiveTranslationMic(!micOn));
    }, [ dispatch, micOn ]);

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
                { t('liveTranslation.unavailable') }
            </Text>
        );
    } else if (readingAloud) {
        stateLine = (
            <Text
                numberOfLines = { 1 }
                style = { styles.hintText as TextStyle }>
                { t('liveTranslation.speakingKeepQuiet') }
            </Text>
        );
    } else if (dictating) {
        stateLine = (
            <>
                <View style = { styles.liveDot as ViewStyle } />
                <Text style = { styles.stateText as TextStyle }>
                    { t('liveTranslation.youAreSpeaking') }
                </Text>
            </>
        );
    } else if (pending > 0) {
        stateLine = (
            <Text style = { styles.stateText as TextStyle }>
                { t('liveTranslation.sending') }
            </Text>
        );
    } else {
        stateLine = (
            <Text
                numberOfLines = { 1 }
                style = { styles.hintText as TextStyle }>
                { error ? t(error) : t(micOn ? 'liveTranslation.listening' : 'liveTranslation.micIsOff') }
            </Text>
        );
    }

    return (
        <View style = { styles.console as ViewStyle }>
            <View style = { styles.stateRow as ViewStyle }>
                { stateLine }
            </View>

            <Waveform active = { dictating } />

            <View style = { styles.controlsRow as ViewStyle }>
                <View style = { styles.sideControl as ViewStyle }>
                    { canReadAloud && (
                        <>
                            <Pressable
                                accessibilityLabel = { t('liveTranslation.readAloud') }
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
                                { readAloud ? t('liveTranslation.sound') : t('liveTranslation.muted') }
                            </Text>
                        </>
                    ) }
                </View>

                <Pressable
                    accessibilityLabel = { t(micOn ? 'liveTranslation.micOff' : 'liveTranslation.micOn') }
                    accessibilityRole = 'button'
                    disabled = { !canRecord }
                    onPress = { toggleListening }
                    style = { [
                        styles.talkButton,
                        dictating && styles.talkButtonRecording,
                        (!canRecord || !micOn) && styles.talkButtonDisabled
                    ] as ViewStyle[] }>
                    { dictating && (
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
                        src = { micOn ? IconMic : IconMicSlash } />
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
