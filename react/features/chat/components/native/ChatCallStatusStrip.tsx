import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconSubtitles } from '../../../base/icons/svg';
import { isChatTtsEnabled } from '../../../caption-tts/functions.native';

import ChatCallLanguagePicker from './ChatCallLanguagePicker';
import { chatCallStyles as styles } from './styles';

/**
 * The strip at the top of the call. It says what this screen is, whether messages are being read out, and carries the
 * picker for the language they are translated into before being read.
 *
 * @returns {JSX.Element}
 */
export default function ChatCallStatusStrip() {
    const { t } = useTranslation();
    const readAloud = useSelector((state: IReduxState) => isChatTtsEnabled(state));

    return (
        <View style = { styles.statusStrip as ViewStyle }>
            <Icon
                color = '#FFFFFF'
                size = { 18 }
                src = { IconSubtitles } />
            <Text style = { styles.statusStripText as TextStyle }>
                { t('chat.call.title') }
            </Text>
            <Text style = { styles.statusStripLanguage as TextStyle }>
                { readAloud ? t('chat.call.readingAloud') : t('chat.call.readAloudOff') }
            </Text>
            <ChatCallLanguagePicker />
        </View>
    );
}
