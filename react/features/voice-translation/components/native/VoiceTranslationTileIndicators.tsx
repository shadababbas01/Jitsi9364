import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import {
    getLocalTranslationPreferences,
    getParticipantTranslationPreferences,
    getVoiceTranslationPeerParticipant,
    getVoiceTranslationState,
    isVoiceTranslationAvailable,
    isVoiceTranslationEnabled
} from '../../functions';
import { getVoiceLanguageDisplayName } from '../../languages';

import styles from './styles';

interface IProps {

    /**
     * Participant ID for the tile.
     */
    participantId: string;
}

/**
 * Native tile badges for speech-to-speech language state.
 *
 * @param {IProps} props - Component props.
 * @returns {React.ReactElement | null}
 */
export default function VoiceTranslationTileIndicators({ participantId }: IProps) {
    const indicator = useSelector((state: IReduxState) => {
        if (!isVoiceTranslationEnabled(state) || !isVoiceTranslationAvailable(state)) {
            return null;
        }

        const localPreferences = getLocalTranslationPreferences(state);
        const peerParticipant = getVoiceTranslationPeerParticipant(state);
        const isPeerTile = peerParticipant?.id === participantId;
        const participantPreferences = isPeerTile
            ? getParticipantTranslationPreferences(state, participantId)
            : localPreferences;
        const peerPreferences = peerParticipant?.id
            ? getParticipantTranslationPreferences(state, peerParticipant.id)
            : null;
        const speakingLanguage = participantPreferences?.fromLanguage;
        const translatingLanguage = isPeerTile ? localPreferences.toLanguage : peerPreferences?.toLanguage;

        if (!speakingLanguage && !translatingLanguage) {
            return null;
        }

        return {
            isTranslating: Boolean(getVoiceTranslationState(state).translatingParticipants?.[participantId]),
            speakingLanguage: getVoiceLanguageDisplayName(speakingLanguage),
            translatingLanguage: getVoiceLanguageDisplayName(translatingLanguage)
        };
    });

    if (!indicator) {
        return null;
    }

    return (
        <View
            pointerEvents = 'none'
            style = { styles.tileLanguageBadgeContainer as ViewStyle }>
            {Boolean(indicator.speakingLanguage) && (
                <View style = { styles.tileLanguageBadge as ViewStyle }>
                    <Text
                        numberOfLines = { 1 }
                        style = { styles.tileLanguageBadgeText }>
                        { `Speaking in ${indicator.speakingLanguage}` }
                    </Text>
                </View>
            )}
            {Boolean(indicator.translatingLanguage) && (
                <View
                    style = { [
                        styles.tileLanguageBadge,
                        indicator.isTranslating && styles.tileLanguageBadgeActive
                    ] as ViewStyle[] }>
                    <Text
                        numberOfLines = { 1 }
                        style = { styles.tileLanguageBadgeText }>
                        { `Translating to ${indicator.translatingLanguage}` }
                    </Text>
                </View>
            )}
        </View>
    );
}
