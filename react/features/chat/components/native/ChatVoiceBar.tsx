import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getLocalMicRecorderNativeModule } from '../../../audio-extraction/functions.native';
import Icon from '../../../base/icons/components/Icon';
import { IconMic, IconStop, IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import { getCaptionsTtsNativeModule, isChatTtsEnabled } from '../../../caption-tts/functions.native';
import transcribeWavFile from '../../../live-transcribe/native/transcribeWav';
import { sendMessage } from '../../actions.native';

import { chatVoiceBarStyles as styles } from './styles';

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
 * A compact bar above the chat input which records what the local participant says and sends the transcript to everyone
 * in the call as a chat message. Reading incoming messages out is done by the caption-tts chat middleware, wherever in
 * the app the local user is; this bar only carries the switch for it.
 *
 * @returns {JSX.Element | null}
 */
export default function ChatVoiceBar() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const readAloud = useSelector((state: IReduxState) => isChatTtsEnabled(state));

    const [ voiceState, setVoiceState ] = useState<VoiceState>('idle');
    const [ elapsedMs, setElapsedMs ] = useState(0);
    const [ notice, setNotice ] = useState('');

    const recorderRef = useRef(getLocalMicRecorderNativeModule());
    const ttsRef = useRef(getCaptionsTtsNativeModule());
    const startedAtRef = useRef(0);
    const cancelledRef = useRef(false);
    const mountedRef = useRef(true);
    const pulse = useRef(new Animated.Value(1)).current;

    const canRecord = Boolean(recorderRef.current?.recordToFile);
    const canReadAloud = Boolean(ttsRef.current?.speak);

    // Leaving the screen only stops the microphone: a message being read out carries on, since read aloud is not tied to
    // the chat being open.
    useEffect(() => () => {
        mountedRef.current = false;
        cancelledRef.current = true;
        recorderRef.current?.stop();
    }, []);

    // Keeps the elapsed counter ticking for as long as the microphone is open.
    useEffect(() => {
        if (voiceState !== 'recording') {
            return;
        }

        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startedAtRef.current);
        }, 250);

        return () => clearInterval(interval);
    }, [ voiceState ]);

    // Fades the live dot while recording so it is clear the microphone is open rather than merely armed.
    useEffect(() => {
        if (voiceState !== 'recording') {
            pulse.setValue(1);

            return;
        }

        const animation = Animated.loop(Animated.sequence([
            Animated.timing(pulse, {
                duration: 600,
                easing: Easing.inOut(Easing.ease),
                toValue: 0.2,
                useNativeDriver: true
            }),
            Animated.timing(pulse, {
                duration: 600,
                easing: Easing.inOut(Easing.ease),
                toValue: 1,
                useNativeDriver: true
            })
        ]));

        animation.start();

        return () => animation.stop();
    }, [ pulse, voiceState ]);

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
    const stopRecording = useCallback(() => {
        recorderRef.current?.stop();
    }, []);

    const toggleRecording = useCallback(() => {
        if (voiceState === 'recording') {
            stopRecording();

            return;
        }

        if (voiceState === 'idle') {
            startRecording();
        }
    }, [ startRecording, stopRecording, voiceState ]);

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

    const isRecording = voiceState === 'recording';
    const isBusy = voiceState === 'transcribing';

    return (
        <View style = { styles.bar as ViewStyle }>
            <Pressable
                accessibilityLabel = { isRecording ? t('chat.voice.stop') : t('chat.voice.start') }
                accessibilityRole = 'button'
                disabled = { !canRecord || isBusy }
                onPress = { toggleRecording }
                style = { [
                    styles.micButton,
                    isRecording && styles.micButtonRecording,
                    (!canRecord || isBusy) && styles.micButtonDisabled
                ] as ViewStyle[] }>
                <Icon
                    color = '#FFFFFF'
                    size = { 20 }
                    src = { isRecording ? IconStop : IconMic } />
            </Pressable>

            <View style = { styles.state as ViewStyle }>
                { isRecording && (
                    <>
                        <Animated.View
                            style = { [ styles.liveDot, { opacity: pulse } ] as ViewStyle[] } />
                        <Text style = { styles.stateText as TextStyle }>
                            { t('chat.voice.speaking') }
                        </Text>
                        <Text style = { styles.elapsedText as TextStyle }>
                            { formatElapsed(elapsedMs) }
                        </Text>
                    </>
                ) }
                { isBusy && (
                    <Text style = { styles.stateText as TextStyle }>
                        { t('chat.voice.transcribing') }
                    </Text>
                ) }
                { voiceState === 'idle' && (
                    <Text
                        numberOfLines = { 1 }
                        style = { styles.hintText as TextStyle }>
                        { notice || (canRecord ? t('chat.voice.hint') : t('chat.voice.unavailable')) }
                    </Text>
                ) }
            </View>

            { canReadAloud && (
                <Pressable
                    accessibilityLabel = { t('chat.voice.readAloud') }
                    accessibilityRole = 'button'
                    onPress = { toggleReadAloud }
                    style = { [
                        styles.readAloudButton,
                        readAloud && styles.readAloudButtonOn
                    ] as ViewStyle[] }>
                    <Icon
                        color = { readAloud ? '#18181B' : '#71717A' }
                        size = { 20 }
                        src = { readAloud ? IconVolumeUp : IconVolumeOff } />
                </Pressable>
            ) }
        </View>
    );
}
