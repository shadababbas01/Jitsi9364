import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconSubtitles } from '../../../base/icons/svg';
import { isChatTtsEnabled, toTtsLanguageTag } from '../../../caption-tts/functions.native';

import { chatCallStyles as styles } from './styles';

/**
 * The strip above the transcript. It says what this screen is - a call being translated rather than a message list - and
 * in which language what arrives will be read back.
 *
 * @returns {JSX.Element}
 */
export default function ChatCallStatusStrip() {
    const { t } = useTranslation();
    const readAloud = useSelector((state: IReduxState) => isChatTtsEnabled(state));
    const language = useSelector((state: IReduxState) =>
        toTtsLanguageTag(state['features/subtitles']._language));

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
                { language.toUpperCase() }
            </Text>
            <Text style = { styles.statusStripAside as TextStyle }>
                { readAloud ? t('chat.call.readingAloud') : t('chat.call.readAloudOff') }
            </Text>
        </View>
    );
}
