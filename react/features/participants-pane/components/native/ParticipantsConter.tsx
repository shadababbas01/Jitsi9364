import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { getParticipantCountForDisplay } from '../../../base/participants/functions';

import styles from './styles';

const ParticipantsCounter = () => {
    const participantsCount = useSelector(getParticipantCountForDisplay);

    return (
        <View style = { styles.participantsBadge as ViewStyle }>
            <Text style = { styles.participantsBadgeText }>
                { participantsCount }
            </Text>
        </View>
    );
};

export default ParticipantsCounter;
