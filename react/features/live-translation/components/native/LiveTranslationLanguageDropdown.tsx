import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
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
import { S2SV2Theme, getS2SV2Palette } from '../../../s2s-v2/components/native/palettes';
import getS2SV2PanelStyles from '../../../s2s-v2/components/native/panelStyles';
import useS2SV2SwipeDismiss from '../../../s2s-v2/components/native/useS2SV2SwipeDismiss';
import { toBaseSubtitlesLanguage } from '../../../subtitles/languages';

import useCaptionLanguages from './useCaptionLanguages';

/**
 * Claims a touch which started on the list itself, so it never reaches the backdrop behind it and closes the list.
 *
 * @returns {boolean}
 */
const returnTrue = () => true;

interface IProps {

    /**
     * What the control is called, used as the heading of the list it opens.
     */
    accessibilityLabel: string;

    /**
     * The small line above the chosen language, naming what the choice is for.
     */
    caption?: string;

    /**
     * What the control is for, read out after its name.
     */
    label: string;

    /**
     * Called with the code of whichever language is chosen.
     */
    onSelect: (code: string) => void;

    /**
     * Which of the two ways to draw it, matching whichever the panel it sits in is currently drawn in.
     */
    theme: S2SV2Theme;

    /**
     * The language currently chosen.
     */
    value: string;
}

/**
 * The language everything is turned into: its name, and a searchable list for changing it.
 *
 * Drawn from the same panel styles the speech-to-speech translation panel and the live captions panel use, so the
 * three read as one idea offered three times rather than three unrelated controls. Kept as its own component rather
 * than the shared {@code S2SV2LanguageDropdown} because the list underneath it is not the same one: this reads from
 * the languages the transcription service can hear rather than the ones {@link S2SV2LanguageDropdown} narrows down to
 * the ones melp's speech engine has a voice for, and swapping the list along with the styling would change what a
 * listener can pick, not just how the control looks.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function LiveTranslationLanguageDropdown(
        { accessibilityLabel, caption, label, onSelect, theme, value }: IProps) {
    const { t } = useTranslation();

    const styles = getS2SV2PanelStyles(theme);
    const muted = getS2SV2Palette(theme).textMuted;
    const accent = getS2SV2Palette(theme).accent;

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

    const openList = useCallback(() => setOpen(true), []);

    const closeList = useCallback(() => {
        setOpen(false);
        setSearch('');
    }, []);

    /**
     * Pulling the list down by its grabber closes it without choosing anything, the same as tapping the backdrop.
     */
    const { handlers, translateY } = useS2SV2SwipeDismiss(closeList, { visible: open });

    const select = useCallback((code: string) => {
        onSelect(code);
        closeList();
    }, [ closeList, onSelect ]);

    return (
        <>
            <Pressable
                accessibilityHint = { label }
                accessibilityLabel = { accessibilityLabel }
                accessibilityRole = 'button'
                onPress = { openList }
                style = { styles.languagePill as ViewStyle }>
                <View style = { styles.languagePillCopy as ViewStyle }>
                    { Boolean(caption) && (
                        <Text style = { styles.languagePillCaption as TextStyle }>
                            { caption }
                        </Text>
                    ) }
                    <Text
                        allowFontScaling = { false }
                        numberOfLines = { 1 }
                        style = { styles.languagePillName as TextStyle }>
                        { name }
                    </Text>
                </View>
                <Icon
                    color = { muted }
                    size = { 14 }
                    src = { IconArrowDown } />
            </Pressable>

            <Modal
                animationType = 'slide'
                onRequestClose = { closeList }
                transparent = { true }
                visible = { open }>
                <Pressable
                    onPress = { closeList }
                    style = { styles.listBackdrop as ViewStyle }>
                    {/* Swallows the press, so tapping inside the list does not close it. */}
                    <Animated.View
                        onStartShouldSetResponder = { returnTrue }
                        style = { [
                            styles.listSheet,
                            { transform: [ { translateY } ] }
                        ] as ViewStyle[] }>
                        <View
                            { ...handlers }
                            style = { styles.grabberZone as ViewStyle }>
                            <View style = { styles.grabber as ViewStyle } />
                        </View>
                        <Text
                            allowFontScaling = { false }
                            style = { styles.listTitle as TextStyle }>
                            { accessibilityLabel }
                        </Text>
                        <TextInput
                            autoCorrect = { false }
                            onChangeText = { setSearch }
                            placeholder = { t('liveTranslation.searchLanguages') }
                            placeholderTextColor = { muted }
                            style = { styles.listSearch as TextStyle }
                            value = { search } />
                        <ScrollView keyboardShouldPersistTaps = 'handled'>
                            { filtered.map(language => {
                                const selected = toBaseSubtitlesLanguage(language.code)
                                    === toBaseSubtitlesLanguage(value);

                                return (
                                    <TouchableHighlight
                                        key = { language.code }

                                        /* eslint-disable-next-line react/jsx-no-bind */
                                        onPress = { () => select(language.code) }
                                        underlayColor = 'rgba(255, 255, 255, 0.06)'>
                                        <View style = { styles.listRow as ViewStyle }>
                                            <Text
                                                allowFontScaling = { false }
                                                style = { [
                                                    styles.listRowText,
                                                    selected && styles.listRowTextActive
                                                ] as TextStyle[] }>
                                                { language.label }
                                            </Text>
                                            { selected && (
                                                <Icon
                                                    color = { accent }
                                                    size = { 18 }
                                                    src = { IconCheck } />
                                            ) }
                                        </View>
                                    </TouchableHighlight>
                                );
                            }) }
                        </ScrollView>
                    </Animated.View>
                </Pressable>
            </Modal>
        </>
    );
}
