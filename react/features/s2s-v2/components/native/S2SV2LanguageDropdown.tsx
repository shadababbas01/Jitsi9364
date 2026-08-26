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
import { toBaseSubtitlesLanguage } from '../../../subtitles/languages';

import { S2SV2Theme, getS2SV2Palette } from './palettes';
import getS2SV2PanelStyles from './panelStyles';
import defaultStyles, { S2S_V2_COLORS } from './styles';
import useS2SV2Languages from './useS2SV2Languages';
import useS2SV2SwipeDismiss from './useS2SV2SwipeDismiss';

/**
 * Claims a touch which started on the list itself, so it never reaches the backdrop behind it and closes the list. The
 * children are asked first, so the rows, the search box and the scroll still get everything aimed at them.
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
     * The small line above the chosen language, naming what the choice is for. Left out where the sheet already has a
     * label of its own above the control.
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
     * Applied to the closed control, so the popup and the panel can size it differently.
     */
    style?: ViewStyle;

    /**
     * Which of the two ways to draw it. Left out in the sheets, which are always dark; given by the panel, which is
     * whichever the local user set it to. A light panel opening a dark list reads as a fault rather than as a choice,
     * so the list which opens follows the surface which opened it.
     */
    theme?: S2SV2Theme;

    /**
     * The language currently chosen.
     */
    value: string;
}

/**
 * The language everything is translated into on this device: what it is set to now, and a searchable list for changing
 * it.
 *
 * Closed, it is a single line showing the current choice - there is only ever one answer, and the list of languages is
 * far too long to lay out in a sheet which also has to hold everything else. Open, it is a list with a search box,
 * because a user who wants Portuguese should not have to scroll past forty languages to find it.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function S2SV2LanguageDropdown(
        { accessibilityLabel, caption, label, onSelect, style, theme, value }: IProps) {
    const { t } = useTranslation();

    const styles = theme ? getS2SV2PanelStyles(theme) : defaultStyles;
    const muted = theme ? getS2SV2Palette(theme).textMuted : S2S_V2_COLORS.textMuted;
    const accent = theme ? getS2SV2Palette(theme).accent : S2S_V2_COLORS.accent;

    const languages = useS2SV2Languages();
    const [ open, setOpen ] = useState(false);
    const [ search, setSearch ] = useState('');

    const name = useMemo(
        () => languages.find(language => language.code === value)?.label
            || (value ? value.toUpperCase() : t('s2sV2.loadingLanguages')),
        [ languages, t, value ]);

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
     *
     * No slide out of its own: the {@code Modal} it is in slides out on its own when it closes. The list is told when
     * it opens instead, so that it comes back at the top rather than still carrying whatever offset closed it.
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
                style = { [ styles.languagePill, style ] as ViewStyle[] }>
                <View style = { styles.languagePillCopy as ViewStyle }>
                    { Boolean(caption) && (
                        <Text style = { styles.languagePillCaption as TextStyle }>
                            { caption }
                        </Text>
                    ) }
                    <Text
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
                        <Text style = { styles.listTitle as TextStyle }>
                            { accessibilityLabel }
                        </Text>
                        <TextInput
                            autoCorrect = { false }
                            onChangeText = { setSearch }
                            placeholder = { t('s2sV2.searchLanguages') }
                            placeholderTextColor = { muted }
                            style = { styles.listSearch as TextStyle }
                            value = { search } />
                        { filtered.length === 0 && (
                            <Text style = { styles.fieldHelper as TextStyle }>
                                { languages.length === 0
                                    ? t('s2sV2.loadingLanguages')
                                    : t('s2sV2.noLanguagesAvailable') }
                            </Text>
                        ) }
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
