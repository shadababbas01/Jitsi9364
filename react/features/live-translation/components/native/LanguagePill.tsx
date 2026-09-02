import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TextStyle,
    TouchableHighlight,
    View,
    ViewStyle
} from 'react-native';

import Icon from '../../../base/icons/components/Icon';
import { IconArrowDown, IconCheck } from '../../../base/icons/svg';
import { toBaseSubtitlesLanguage } from '../../../subtitles/languages';

import styles, { LIVE_TRANSLATION_COLORS } from './styles';
import useCaptionLanguages from './useCaptionLanguages';

/**
 * The language everything is turned into: its name, and a sheet for changing it.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
export default function LanguagePill({ accessibilityLabel, label, onSelect, style, value }: {
    accessibilityLabel: string;
    label: string;
    onSelect: (code: string) => void;
    style?: ViewStyle;
    value: string;
}) {
    const { t } = useTranslation();

    const languages = useCaptionLanguages();
    const [ open, setOpen ] = useState(false);
    const [ search, setSearch ] = useState('');

    const name = useMemo(
        () => languages.find(language => language.code === value)?.label || value.toUpperCase(),
        [ languages, value ]);

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return languages;
        }

        return languages.filter(language => language.label.toLowerCase().includes(needle)
            || language.code.toLowerCase().includes(needle));
    }, [ languages, search ]);

    const openSheet = useCallback(() => setOpen(true), []);

    const closeSheet = useCallback(() => {
        setOpen(false);
        setSearch('');
    }, []);

    const select = useCallback((code: string) => {
        onSelect(code);
        closeSheet();
    }, [ closeSheet, onSelect ]);

    return (
        <>
            <Pressable
                accessibilityHint = { label }
                accessibilityLabel = { accessibilityLabel }
                accessibilityRole = 'button'
                onPress = { openSheet }
                style = { [ styles.languagePill, style ] as ViewStyle[] }>
                <Text
                    allowFontScaling = { false }
                    numberOfLines = { 1 }
                    style = { styles.languagePillName as TextStyle }>
                    { name }
                </Text>
                <View style = { styles.languagePillTrailing as ViewStyle }>
                    <Icon
                        color = { LIVE_TRANSLATION_COLORS.textMuted }
                        size = { 14 }
                        src = { IconArrowDown } />
                </View>
            </Pressable>

            <Modal
                animationType = 'slide'
                onRequestClose = { closeSheet }
                transparent = { true }
                visible = { open }>
                <Pressable
                    onPress = { closeSheet }
                    style = { styles.sheetBackdrop as ViewStyle }>
                    {/* Swallows the press so tapping inside the sheet does not close it. */}
                    <Pressable style = { styles.sheet as ViewStyle }>
                        <View style = { styles.grabber as ViewStyle } />
                        <Text
                            allowFontScaling = { false }
                            style = { styles.sheetTitle as TextStyle }>
                            { accessibilityLabel }
                        </Text>
                        <TextInput
                            autoCorrect = { false }
                            onChangeText = { setSearch }
                            placeholder = { t('liveTranslation.searchLanguages') }
                            placeholderTextColor = { LIVE_TRANSLATION_COLORS.textMuted }
                            style = { styles.sheetSearch as TextStyle }
                            value = { search } />
                        <ScrollView keyboardShouldPersistTaps = 'handled'>
                            { filtered.map(language => {
                                const selected
                                    = toBaseSubtitlesLanguage(language.code) === toBaseSubtitlesLanguage(value);

                                return (
                                    <TouchableHighlight
                                        key = { language.code }

                                        /* eslint-disable-next-line react/jsx-no-bind */
                                        onPress = { () => select(language.code) }
                                        underlayColor = 'rgba(255, 255, 255, 0.06)'>
                                        <View style = { styles.sheetRow as ViewStyle }>
                                            <Text
                                                allowFontScaling = { false }
                                                style = { [
                                                    styles.sheetRowText,
                                                    selected && styles.sheetRowTextActive
                                                ] as TextStyle[] }>
                                                { language.label }
                                            </Text>
                                            { selected && (
                                                <Icon
                                                    color = { LIVE_TRANSLATION_COLORS.accent }
                                                    size = { 18 }
                                                    src = { IconCheck } />
                                            ) }
                                        </View>
                                    </TouchableHighlight>
                                );
                            }) }
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
