import React from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioCallToolbox from './AudioCallToolbox';
import CalleeDetails from './CalleeDetails';
import styles from './styles';

/**
 * The dedicated phone-call-style content rendered in place of the normal video UI for
 * audio-only calls.
 *
 * @returns {JSX.Element}
 */
const AudioCallContent = (): JSX.Element => (
    <SafeAreaView style = { styles.conference as ViewStyle }>
        <CalleeDetails />
        <AudioCallToolbox />
    </SafeAreaView>
);

export default AudioCallContent;
