/* eslint-disable react/no-multi-comp */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, ScrollView, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Avatar from '../../../base/avatar/components/Avatar';
import Icon from '../../../base/icons/components/Icon';
import { IconCloseLarge, IconTranslate } from '../../../base/icons/svg';
import { getLocalParticipant } from '../../../base/participants/functions';
import { updateSettings } from '../../../base/settings/actions';
import { getChatReadAloudLanguage, getChatTtsSpeakerId } from '../../../caption-tts/functions.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { setLiveTranslationActive } from '../../actions';
import { LIVE_TRANSLATION_TOOLBAR_RESERVE } from '../../constants';
import { getLiveTranslationPanelHeight, getLiveTranslationState } from '../../functions.native';

import LanguagePill from './LanguagePill';
import styles, { LIVE_TRANSLATION_COLORS } from './styles';

/**
 * How many bars the speaking meter is drawn with.
 */
const WAVEFORM_BARS = 5;

/**
 * The bars drawn next to whoever is talking. A spoken message has no text to show here, so this stands in for it the way
 * the waveform next to a voice note does.
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
 * A participant, and whether they are the one talking.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
function SpeakerRow({ displayName, participantId, speaking, state }: {
    displayName: string;
    participantId: string;
    speaking: boolean;
    state: string;
}) {
    return (
        <View
            style = { [
                styles.speakerRow,
                speaking && styles.speakerRowActive
            ] as ViewStyle[] }>
            <View style = { styles.avatarWrapper as ViewStyle }>
                <Avatar
                    displayName = { displayName }
                    participantId = { participantId }
                    size = { 32 } />
                { speaking && <View style = { styles.avatarRing as ViewStyle } /> }
            </View>
            <View style = { styles.speakerText as ViewStyle }>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.speakerName as TextStyle }>
                    { displayName }
                </Text>
                { Boolean(state) && (
                    <Text
                        numberOfLines = { 1 }
                        style = { [
                            styles.speakerState,
                            speaking && styles.speakerStateActive
                        ] as TextStyle[] }>
                        { state }
                    </Text>
                ) }
            </View>
            { speaking && <Waveform /> }
        </View>
    );
}

/**
 * The live translation call, shown under the video in the way the live captions panel is: what the call is doing at the
 * top, the language everything is turned into under it, and where a transcript would be, who is talking right now.
 * Nothing anybody says is written out - it is read aloud.
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
    const heardLanguage = useSelector(getChatReadAloudLanguage);
    const localParticipant = useSelector(getLocalParticipant);

    // Whoever is in the meeting is kept in a map which is written into rather than replaced, so watching the map itself
    // would show the room as it was when the panel was opened and never again. The slice around it is a fresh object on
    // every participant action, which is what keeps the list up to date as people come and go.
    const participants = useSelector((state: IReduxState) => state['features/base/participants']);
    const { defaultLocalDisplayName, defaultRemoteDisplayName }
        = useSelector((state: IReduxState) => state['features/base/config']);

    const remotes = useMemo(
        () => Array.from(participants.remote.values()).filter(participant => !participant.fakeParticipant),
        [ participants ]);

    const selectHeard = useCallback((code: string) => {
        dispatch(updateSettings({ chatReadAloudLanguage: code }));
    }, [ dispatch ]);

    const close = useCallback(() => {
        dispatch(setLiveTranslationActive(false));
    }, [ dispatch ]);

    if (!active || !height) {
        return null;
    }

    const nameOf = (participant?: { local?: boolean; name?: string; }) => participant?.name
        || (participant?.local ? defaultLocalDisplayName : defaultRemoteDisplayName)
        || '';

    // Everyone the local user has to know about: whoever is talking is at the top, so it is the first thing read.
    const rows = [];

    if (localParticipant) {
        // Nothing is said about somebody who is not doing anything: a row of "Quiet" against every name is noise, and
        // the point of the list is to make the one person who is talking stand out.
        let localState = '';

        if (dictating) {
            localState = t('liveTranslation.youAreSpeaking');
        } else if (pending > 0) {
            localState = t('liveTranslation.sending');
        } else if (!micOn) {
            localState = t('liveTranslation.micIsOff');
        } else if (error) {
            localState = t(error);
        }

        rows.push({
            displayName: `${nameOf(localParticipant)} (${t('chat.you')})`,
            id: localParticipant.id,
            speaking: dictating,
            state: localState
        });
    }

    remotes.forEach(participant => {
        const speaking = participant.id === speakerId;

        rows.push({
            displayName: nameOf(participant),
            id: participant.id,
            speaking,
            state: speaking ? t('liveTranslation.speakingNow') : ''
        });
    });

    rows.sort((a, b) => Number(b.speaking) - Number(a.speaking));

    return (
        <View style = { [ styles.panel, { height } ] as ViewStyle[] }>
            <View style = { styles.grabber as ViewStyle } />

            <View style = { styles.surface as ViewStyle }>
                <View style = { styles.header as ViewStyle }>
                    <View style = { styles.headerIcon as ViewStyle }>
                        <Icon
                            color = { LIVE_TRANSLATION_COLORS.text }
                            size = { 18 }
                            src = { IconTranslate } />
                    </View>
                    <View style = { styles.headerCopy as ViewStyle }>
                        <Text
                            numberOfLines = { 1 }
                            style = { styles.liveLabel as TextStyle }>
                            { t('liveTranslation.title') }
                        </Text>
                    </View>
                    <View style = { styles.headerActions as ViewStyle }>
                        <LanguagePill
                            accessibilityLabel = { t('liveTranslation.translateInto') }
                            label = { t('liveTranslation.translateInto') }
                            onSelect = { selectHeard }
                            value = { heardLanguage } />
                        <Pressable
                            accessibilityLabel = { t('liveTranslation.turnOff') }
                            accessibilityRole = 'button'
                            onPress = { close }
                            style = { styles.closeButton as ViewStyle }>
                            <Icon
                                color = { LIVE_TRANSLATION_COLORS.textMuted }
                                size = { 16 }
                                src = { IconCloseLarge } />
                        </Pressable>
                    </View>
                </View>

                <Text style = { styles.sectionTitle as TextStyle }>
                    { t('liveTranslation.participants', 'Participants') }
                </Text>

                <ScrollView
                    contentContainerStyle = { [
                        styles.speakersContent,

                        // The toolbar is out of the way until it is tapped back on, and then it floats over the bottom of
                        // the panel, so the list steps aside for exactly as long as it is there.
                        { paddingBottom: safeAreaBottom + (toolboxVisible ? LIVE_TRANSLATION_TOOLBAR_RESERVE : 0) }
                    ] as ViewStyle[] }
                    style = { styles.speakers as ViewStyle }>
                    { rows.length === 0
                        ? (
                            <Text style = { styles.emptyText as TextStyle }>
                                { t('liveTranslation.nobodyHere') }
                            </Text>
                        )
                        : rows.map(row => (
                            <SpeakerRow
                                displayName = { row.displayName }
                                key = { row.id }
                                participantId = { row.id }
                                speaking = { row.speaking }
                                state = { row.state } />
                        )) }
                </ScrollView>
            </View>
        </View>
    );
}
