/* eslint-disable react/no-multi-comp */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Easing,
    LayoutChangeEvent,
    Pressable,
    ScrollView,
    Text,
    TextStyle,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconTranslate } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import {
    getChatReadAloudLanguage,
    getChatTtsSpeakerId,
    getChatTtsSpeakingMessageId
} from '../../../caption-tts/functions.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { setLiveTranslationActive } from '../../actions';
import { LIVE_TRANSLATION_TOOLBAR_RESERVE } from '../../constants';
import {
    getLiveTranslationPanelHeight,
    getLiveTranslationState,
    getLiveTranslationUtterances
} from '../../functions.native';
import { ILiveTranslationUtterance } from '../../reducer';

import LanguagePill from './LanguagePill';
import styles, { LIVE_TRANSLATION_COLORS } from './styles';

/**
 * How many bars the speaking meter is drawn with.
 */
const WAVEFORM_BARS = 5;

/**
 * The bars drawn next to the utterance being read out, in place of the level meter its voice would draw.
 *
 * @returns {JSX.Element}
 */
function Waveform() {
    const scales = useMemo(
        () => Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(0.25)),
        []);

    useEffect(() => {
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
                    toValue: 0.25,
                    useNativeDriver: true
                })
            ]));
        });

        animations.forEach((animation, index) => setTimeout(() => animation.start(), index * 70));

        return () => animations.forEach(animation => animation.stop());
    }, [ scales ]);

    return (
        <View style = { styles.waveform as ViewStyle }>
            { scales.map((scale, index) => (
                <Animated.View
                    key = { index }
                    style = { [
                        styles.waveformBar,
                        { transform: [ { scaleY: scale } ] }
                    ] as ViewStyle[] } />
            )) }
        </View>
    );
}

/**
 * One thing somebody said: who said it, what came through, and underneath it the translation being read out loud in its
 * place.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
function UtteranceCard({ displayName, onMeasure, pendingLabel, speaking, utterance }: {
    displayName: string;
    onMeasure: (id: string, y: number) => void;
    pendingLabel: string;
    speaking: boolean;
    utterance: ILiveTranslationUtterance;
}) {
    const measure = useCallback(
        (event: LayoutChangeEvent) => onMeasure(utterance.id, event.nativeEvent.layout.y),
        [ onMeasure, utterance.id ]);

    // A translation which came back the same as what was said is the same sentence twice: it is either being read out in
    // the language it arrived in or the service had nothing to change, and either way there is one line to show, not
    // two. Until it comes back at all there is a line to hold, so the card does not grow when it does.
    const waiting = utterance.translation === null;
    const translation = !waiting && utterance.translation !== utterance.text ? utterance.translation : '';

    return (
        <View
            onLayout = { measure }
            style = { [
                styles.transcriptCard,
                speaking && styles.transcriptCardSpeaking
            ] as ViewStyle[] }>
            <View style = { styles.senderBadge as ViewStyle }>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.senderBadgeText as TextStyle }>
                    { displayName }
                </Text>
            </View>
            <View style = { styles.utteranceText as ViewStyle }>
                <Text style = { styles.utteranceOriginal as TextStyle }>
                    { utterance.text }
                </Text>
                { (translation || waiting) && (
                    <Text
                        style = { [
                            styles.utteranceTranslation,
                            waiting && styles.utteranceTranslationPending
                        ] as TextStyle[] }>
                        { waiting ? pendingLabel : translation }
                    </Text>
                ) }
            </View>
            { speaking && <Waveform /> }
        </View>
    );
}

/**
 * The live translation call, shown under the video in the way the live captions panel is: what the call is doing on one
 * line at the top, what has been said under it, and the language everything is turned into and the way out at the
 * bottom.
 *
 * Each thing said is shown as it came through and as it is read out loud, so that the sentence being heard can be
 * followed and, where the original is half understood, checked against it. They are kept in a list rather than replacing
 * one another, so the last few minutes of the call can be read back.
 *
 * @returns {JSX.Element | null}
 */
export default function LiveTranslationPanel() {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const height = useSelector(getLiveTranslationPanelHeight);
    const safeAreaBottom = useSelector((state: IReduxState) =>
        state['features/base/responsive-ui'].safeAreaInsets?.bottom ?? 0);
    const { active, dictating, error, micOn, pending } = useSelector(getLiveTranslationState);
    const toolboxVisible = useSelector(isToolboxVisible);
    const speakerId = useSelector(getChatTtsSpeakerId);
    const speakingId = useSelector(getChatTtsSpeakingMessageId);
    const heardLanguage = useSelector(getChatReadAloudLanguage);
    const utterances = useSelector(getLiveTranslationUtterances);

    // Whoever is in the meeting is kept in a map which is written into rather than replaced, so watching the map itself
    // would show the room as it was when the panel was opened and never again. The slice around it is a fresh object on
    // every participant action, which is what keeps the names up to date as people come and go.
    const participants = useSelector((state: IReduxState) => state['features/base/participants']);
    const { defaultRemoteDisplayName }
        = useSelector((state: IReduxState) => state['features/base/config']);

    const scroll = useRef<ScrollView>(null);

    // Where each card sits in the list, so that the one being read can be scrolled to. Reported by the cards
    // themselves: they are as tall as what was said, so nothing else knows.
    const offsets = useRef(new Map<string, number>());

    const measure = useCallback((id: string, y: number) => {
        offsets.current.set(id, y);
    }, []);

    const nameOf = useCallback((participantId: string) =>
        participants.remote.get(participantId)?.name || defaultRemoteDisplayName || '',
    [ defaultRemoteDisplayName, participants ]);

    // The list follows whatever is being read out. Several messages can arrive faster than they can be spoken, and the
    // mark on the one the engine has reached is worth nothing if the list has already run past it to the newest.
    useEffect(() => {
        const y = speakingId && offsets.current.get(speakingId);

        if (typeof y === 'number') {
            scroll.current?.scrollTo({
                animated: true,
                y
            });
        }
    }, [ speakingId ]);

    // Cards which have scrolled out of the store are not coming back, and their offsets would otherwise be kept for the
    // rest of the meeting.
    useEffect(() => {
        const ids = new Set(utterances.map(utterance => utterance.id));

        offsets.current.forEach((_, id) => {
            if (!ids.has(id)) {
                offsets.current.delete(id);
            }
        });
    }, [ utterances ]);

    // Nothing being read means nothing to follow, so the list goes to the newest: it is what the panel is for.
    const follow = useCallback(() => {
        if (!speakingId) {
            scroll.current?.scrollToEnd({ animated: true });
        }
    }, [ speakingId ]);

    const selectHeard = useCallback((code: string) => {
        dispatch(updateSettings({ chatReadAloudLanguage: code }));
    }, [ dispatch ]);

    const close = useCallback(() => {
        dispatch(setLiveTranslationActive(false));
    }, [ dispatch ]);

    if (!active || !height) {
        return null;
    }

    // What the call is doing with the sound right now. The local participant's own state comes first: it is the one
    // thing they can act on, by waiting or by speaking again.
    let status = t('liveTranslation.listening');
    let statusStyle: TextStyle | null = null;

    if (dictating) {
        status = t('liveTranslation.youAreSpeaking');
        statusStyle = styles.statusTextActive as TextStyle;
    } else if (pending > 0) {
        status = t('liveTranslation.sending');
    } else if (!micOn) {
        status = t('liveTranslation.micIsOff');
    } else if (error) {
        status = t(error);
        statusStyle = styles.statusTextError as TextStyle;
    } else if (speakerId) {
        status = t('liveTranslation.someoneSpeakingKeepQuiet', { name: nameOf(speakerId) });
        statusStyle = styles.statusTextActive as TextStyle;
    }

    return (
        <View style = { [ styles.panel, { height } ] as ViewStyle[] }>
            <View
                style = { [
                    styles.surface,

                    // The toolbar is out of the way until it is tapped back on, and then it floats over the bottom of
                    // the panel, so the panel's own contents step aside for exactly as long as it is there.
                    { paddingBottom: safeAreaBottom + (toolboxVisible ? LIVE_TRANSLATION_TOOLBAR_RESERVE : 0) }
                ] as ViewStyle[] }>
                <View style = { styles.statusRow as ViewStyle }>
                    <View style = { styles.statusIcon as ViewStyle }>
                        <Icon
                            color = { LIVE_TRANSLATION_COLORS.textMuted }
                            size = { 14 }
                            src = { IconTranslate } />
                    </View>
                    <Text
                        numberOfLines = { 1 }
                        style = { [ styles.statusText, statusStyle ] as TextStyle[] }>
                        { status }
                    </Text>
                </View>

                { utterances.length === 0
                    ? (
                        <View style = { styles.emptyCard as ViewStyle }>
                            <Text style = { styles.emptyCardText as TextStyle }>
                                { t('liveTranslation.waitingForSpeech') }
                            </Text>
                        </View>
                    )
                    : (
                        <ScrollView
                            contentContainerStyle = { styles.transcriptContent as ViewStyle }
                            onContentSizeChange = { follow }
                            ref = { scroll }
                            style = { styles.transcript as ViewStyle }>
                            { utterances.map(utterance => (
                                <UtteranceCard
                                    displayName = { nameOf(utterance.participantId) }
                                    key = { utterance.id }
                                    onMeasure = { measure }
                                    pendingLabel = { t('liveTranslation.translating') }
                                    speaking = { utterance.id === speakingId }
                                    utterance = { utterance } />
                            )) }
                        </ScrollView>
                    ) }

                <View style = { styles.controls as ViewStyle }>
                    <Text
                        numberOfLines = { 1 }
                        style = { styles.controlsLabel as TextStyle }>
                        { t('liveTranslation.translateTo') }
                    </Text>
                    <LanguagePill
                        accessibilityLabel = { t('liveTranslation.translateInto') }
                        label = { t('liveTranslation.translateInto') }
                        onSelect = { selectHeard }
                        value = { heardLanguage } />
                    <Pressable
                        accessibilityLabel = { t('liveTranslation.turnOff') }
                        accessibilityRole = 'button'
                        onPress = { close }
                        style = { styles.ccButton as ViewStyle }>
                        <Text style = { styles.ccMark as TextStyle }>
                            { t('liveTranslation.cc') }
                        </Text>
                        <Text style = { styles.ccState as TextStyle }>
                            { t('liveTranslation.on') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
