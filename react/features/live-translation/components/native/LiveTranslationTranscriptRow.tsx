/* eslint-disable react/no-multi-comp */

import React, { useCallback, useEffect, useMemo } from 'react';
import { Animated, Easing, LayoutChangeEvent, Text, TextStyle, View, ViewStyle } from 'react-native';

import Avatar from '../../../base/avatar/components/Avatar';
import { S2SV2Theme, getS2SV2Palette } from '../../../s2s-v2/components/native/palettes';
import getS2SV2PanelStyles from '../../../s2s-v2/components/native/panelStyles';
import { ILiveTranslationUtterance } from '../../reducer';

/**
 * How big the speaker's picture is drawn, sized to sit on one line with their name and the time.
 */
const SPEAKER_AVATAR_SIZE = 24;

/**
 * How many bars the speaking meter is drawn with.
 */
const WAVEFORM_BARS = 5;

const waveformStyles = {
    waveform: {
        alignItems: 'center' as const,
        flexDirection: 'row' as const,
        height: 16,
        justifyContent: 'flex-end' as const,
        marginLeft: 8,
        width: 28
    },
    waveformBar: {
        borderRadius: 999,
        height: 12,
        marginLeft: 2,
        width: 2
    }
};

/**
 * The bars drawn next to the utterance being read out, in place of the level meter its voice would draw.
 *
 * @param {Object} props - Component props.
 * @returns {JSX.Element}
 */
function Waveform({ color }: { color: string; }) {
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
        <View style = { waveformStyles.waveform }>
            { scales.map((scale, index) => (
                <Animated.View
                    key = { index }
                    style = { [
                        waveformStyles.waveformBar,
                        {
                            backgroundColor: color,
                            transform: [ { scaleY: scale } ]
                        }
                    ] as ViewStyle[] } />
            )) }
        </View>
    );
}

interface IProps {

    /**
     * Who said it, looked up from their participant ID.
     */
    displayName: string;

    /**
     * Whether this is the top one, which has nothing above it to be separated from.
     */
    first: boolean;

    /**
     * Called with this utterance's ID and where it landed, so the panel can scroll back to it while it is being read.
     */
    onMeasure: (id: string, y: number) => void;

    /**
     * Read out in place of the translation while the service is still working on it.
     */
    pendingLabel: string;

    /**
     * Whether this utterance is the one currently being read aloud.
     */
    speaking: boolean;

    /**
     * Which of the two ways the panel is drawn.
     */
    theme: S2SV2Theme;

    /**
     * The utterance to show.
     */
    utterance: ILiveTranslationUtterance;
}

/**
 * When an utterance was said, as a clock would show it.
 *
 * @param {number} timestamp - When it was said, by the speaker's clock.
 * @returns {string}
 */
function _time(timestamp: number): string {
    const at = new Date(timestamp);
    const hours = at.getHours();

    return `${hours % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * One thing somebody said in a live translation call: who said it, what came through, and the translation being read
 * out in its place.
 *
 * A translation which came back the same as what was said is the same sentence twice: it is either being read out in
 * the language it arrived in or the service had nothing to change, and either way there is one line to show, not two.
 * Until it comes back at all there is a line to hold, so the row does not grow when it does.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function LiveTranslationTranscriptRow(
        { displayName, first, onMeasure, pendingLabel, speaking, theme, utterance }: IProps) {
    const styles = getS2SV2PanelStyles(theme);
    const palette = getS2SV2Palette(theme);

    const measure = useCallback(
        (event: LayoutChangeEvent) => onMeasure(utterance.id, event.nativeEvent.layout.y),
        [ onMeasure, utterance.id ]);

    const waiting = utterance.translation === null;
    const translation = !waiting && utterance.translation !== utterance.text ? utterance.translation : '';

    return (
        <View
            onLayout = { measure }
            style = { [
                styles.transcriptEntry,
                first && styles.transcriptEntryFirst,
                speaking && styles.transcriptEntryPending
            ] as ViewStyle[] }>
            <View style = { styles.transcriptMeta as ViewStyle }>
                <View style = { styles.transcriptAvatar as ViewStyle }>
                    <Avatar
                        displayName = { displayName }
                        participantId = { utterance.participantId }
                        size = { SPEAKER_AVATAR_SIZE } />
                </View>
                <Text
                    allowFontScaling = { false }
                    numberOfLines = { 1 }
                    style = { styles.transcriptSpeaker as TextStyle }>
                    { displayName }
                </Text>
                <Text
                    allowFontScaling = { false }
                    numberOfLines = { 1 }
                    style = { styles.transcriptTime as TextStyle }>
                    { _time(utterance.timestamp) }
                </Text>
                { speaking && <Waveform color = { palette.accent } /> }
            </View>

            <Text
                allowFontScaling = { false }
                style = { styles.transcriptOriginal as TextStyle }>
                { utterance.text }
            </Text>

            { translation ? (
                <Text
                    allowFontScaling = { false }
                    style = { styles.transcriptTranslated as TextStyle }>
                    { translation }
                </Text>
            ) : waiting && (
                <Text
                    allowFontScaling = { false }
                    style = { styles.transcriptTranslating as TextStyle }>
                    { pendingLabel }
                </Text>
            ) }
        </View>
    );
}
