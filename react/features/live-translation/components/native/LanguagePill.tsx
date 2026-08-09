import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
    ILiveCaptionsLanguage,
    fetchLiveCaptionsLanguages,
    toBaseSubtitlesLanguage
} from '../../../subtitles/languages';

import styles, { LIVE_TRANSLATION_COLORS } from './styles';

/**
 * The languages to fall back on while the list is being fetched, or if fetching it fails.
 */
const FALLBACK_CODES = [ 'en', 'hi', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'pt', 'ru' ];

/**
 * One end of the language pair: the name of the language, its code underneath, and a sheet for changing it.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
export default function LanguagePill({ accessibilityLabel, label, onSelect, value }: {
    accessibilityLabel: string;
    label: string;
    onSelect: (code: string) => void;
    value: string;
}) {
    const { t } = useTranslation();

    const [ languages, setLanguages ] = useState<ILiveCaptionsLanguage[]>([]);
    const [ open, setOpen ] = useState(false);
    const [ search, setSearch ] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetchLiveCaptionsLanguages(FALLBACK_CODES).then(fetched => {
            if (!cancelled) {
                setLanguages(fetched);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

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
                accessibilityLabel = { accessibilityLabel }
                accessibilityRole = 'button'
                onPress = { openSheet }
                style = { styles.languagePill as ViewStyle }>
                <View style = { styles.languagePillLabels as ViewStyle }>
                    <Text style = { styles.languagePillLabel as TextStyle }>
                        { label }
                    </Text>
                    <Text
                        numberOfLines = { 1 }
                        style = { styles.languagePillName as TextStyle }>
                        { name }
                    </Text>
                </View>
                <View style = { styles.languagePillTrailing as ViewStyle }>
                    <View style = { styles.languagePillCodeChip as ViewStyle }>
                        <Text style = { styles.languagePillCode as TextStyle }>
                            { value.toUpperCase() }
                        </Text>
                    </View>
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
                        <Text style = { styles.sheetTitle as TextStyle }>
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
