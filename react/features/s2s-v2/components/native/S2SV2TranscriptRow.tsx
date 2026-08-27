import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextStyle, View, ViewStyle } from 'react-native';

import Avatar from '../../../base/avatar/components/Avatar';
import { IS2SV2TranscriptEntry } from '../../reducer';

import { S2SV2Theme } from './palettes';
import getS2SV2PanelStyles from './panelStyles';

/**
 * How big the speaker's picture is drawn, sized to sit on one line with their name and the time.
 */
const SPEAKER_AVATAR_SIZE = 24;

interface IProps {

    /**
     * The utterance to show.
     */
    entry: IS2SV2TranscriptEntry;

    /**
     * Whether this is the top one, which has nothing above it to be separated from.
     */
    first: boolean;

    /**
     * Whether a translation is on its way for this line. False when the listener is already listening in the language
     * it was said in, where there is nothing to wait for and nothing to add underneath.
     */
    pending: boolean;

    /**
     * Whether this line is currently being read aloud.
     */
    speaking: boolean;

    /**
     * Which of the two ways the panel is drawn.
     */
    theme: S2SV2Theme;
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
 * One utterance in the transcript: who said it, when, what they said, and what it came to.
 *
 * Both lines are always shown and neither can be hidden. What was said is the record and what it came to is what the
 * listener is acting on, so a reader who wants to check one against the other should not have to ask for it.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function S2SV2TranscriptRow({ entry, first, pending, speaking, theme }: IProps) {
    const { t } = useTranslation();
    const styles = getS2SV2PanelStyles(theme);

    return (
        <View
            style = { [
                styles.transcriptEntry,
                first && styles.transcriptEntryFirst,
                (pending || speaking) && styles.transcriptEntryPending
            ] as ViewStyle[] }>
            <View style = { styles.transcriptMeta as ViewStyle }>
                <View style = { styles.transcriptAvatar as ViewStyle }>
                    <Avatar
                        displayName = { entry.speakerName }
                        participantId = { entry.speakerId }
                        size = { SPEAKER_AVATAR_SIZE } />
                </View>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.transcriptSpeaker as TextStyle }>
                    { entry.speakerName }
                </Text>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.transcriptTime as TextStyle }>
                    { _time(entry.timestamp) }
                </Text>
            </View>

            <Text style = { styles.transcriptOriginal as TextStyle }>
                { entry.originalText }
            </Text>

            { entry.translatedText ? (
                <Text style = { styles.transcriptTranslated as TextStyle }>
                    { entry.translatedText }
                </Text>
            ) : pending && (
                <Text style = { styles.transcriptTranslating as TextStyle }>
                    { t('s2sV2.panel.translating') }
                </Text>
            ) }
        </View>
    );
}
