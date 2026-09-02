import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { setS2SV2Theme } from '../../actions';
import { getS2SV2Theme } from '../../functions';

import { S2SV2Theme } from './palettes';
import getS2SV2PanelStyles from './panelStyles';

/**
 * The two ways the panel can be drawn, in the order they are offered.
 */
const THEMES: S2SV2Theme[] = [ 'light', 'dark' ];

/**
 * Switches the panel between its light and its dark form.
 *
 * The meeting around it stays as it is. This is a reading preference rather than a theme for the application: the panel
 * is the one surface here anybody reads more than a few words on, and a dark screen is not always the easier of the two
 * to read a paragraph off. Kept between sessions, and kept on the device, like the other two preferences the panel
 * holds - nothing about it is anybody else's business and none of it goes near the wire.
 *
 * @returns {JSX.Element}
 */
export default function S2SV2ThemeToggle() {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const theme = useSelector(getS2SV2Theme);
    const styles = getS2SV2PanelStyles(theme);

    const select = useCallback((next: S2SV2Theme) => dispatch(setS2SV2Theme(next)), [ dispatch ]);

    return (
        <View
            accessibilityLabel = { t('s2sV2.panel.theme.label') }
            accessibilityRole = 'radiogroup'
            style = { styles.themeToggle as ViewStyle }>
            { THEMES.map(option => {
                const selected = theme === option;

                return (
                    <Pressable
                        accessibilityLabel = { t(`s2sV2.panel.theme.${option}`) }
                        accessibilityRole = 'radio'
                        accessibilityState = {{ selected }}
                        key = { option }

                        /* eslint-disable-next-line react/jsx-no-bind */
                        onPress = { () => select(option) }
                        style = { [
                            styles.themeSegment,
                            selected && styles.themeSegmentSelected
                        ] as ViewStyle[] }>
                        <Text
                            allowFontScaling = { false }
                            style = { [
                                styles.themeSegmentLabel,
                                selected && styles.themeSegmentLabelSelected
                            ] as TextStyle[] }>
                            { t(`s2sV2.panel.theme.${option}`) }
                        </Text>
                    </Pressable>
                );
            }) }
        </View>
    );
}
