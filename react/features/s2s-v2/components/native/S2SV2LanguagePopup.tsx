import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import Icon from '../../../base/icons/components/Icon';
import { IconTranslate } from '../../../base/icons/svg';
import Switch from '../../../base/ui/components/native/Switch';
import {
    setS2SV2LanguagePopupVisible,
    setS2SV2PanelVisible,
    setS2SV2SuppressOriginalVoice,
    setS2SV2TargetLanguage
} from '../../actions';
import { getS2SV2TargetLanguage, shouldSuppressOriginalVoice } from '../../functions';

import S2SV2LanguageDropdown from './S2SV2LanguageDropdown';
import styles, { S2S_V2_COLORS } from './styles';
import useS2SV2SwipeDismiss from './useS2SV2SwipeDismiss';

/**
 * Which language everybody is heard in on this device, and whether their own voices are turned down underneath the
 * translation.
 *
 * The same sheet for everybody, because by the time it opens there is always a session running: a moderator starts one
 * on the press of the button and is then asked this, exactly as somebody who has just been told about a session is.
 * Neither answer is sent to anybody - translation happens on the device doing the listening, which is what lets ten
 * listeners in ten languages cost one message on the wire rather than ten.
 *
 * Turning the sheet down is not declining. The session carries on and this device stays in it on whatever it was
 * already set to: the sheet asks which language to listen in, not whether to take part.
 *
 * @returns {JSX.Element}
 */
export default function S2SV2LanguagePopup() {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const savedLanguage = useSelector(getS2SV2TargetLanguage);
    const savedSuppress = useSelector(shouldSuppressOriginalVoice);

    const [ language, setLanguage ] = useState(savedLanguage);
    const [ suppress, setSuppress ] = useState(savedSuppress);

    // The switch also answers presses which carry no value of their own.
    const toggle = useCallback((on?: boolean) => setSuppress(Boolean(on)), []);

    const dismiss = useCallback(() => {
        dispatch(setS2SV2LanguagePopupVisible(false));
    }, [ dispatch ]);

    /**
     * Pulling the sheet down by its grabber turns it down, exactly as the button of that name does.
     *
     * No slide out of its own: the {@code BottomSheet} around it is already in a {@code SlidingView} which slides the
     * whole thing off the bottom when it closes. The drag offset is left where the finger put it so that slide picks
     * the sheet up from there and carries on down, instead of snapping it back up first.
     */
    const { handlers, translateY } = useS2SV2SwipeDismiss(dismiss);

    const proceed = useCallback(() => {
        dispatch(setS2SV2TargetLanguage(language));
        dispatch(setS2SV2SuppressOriginalVoice(suppress));
        dispatch(setS2SV2LanguagePopupVisible(false));
        dispatch(setS2SV2PanelVisible(true));
    }, [ dispatch, language, suppress ]);

    return (
        <BottomSheet
            addScrollViewPadding = { false }
            onCancel = { dismiss }
            style = { styles.sheetChrome }>
            <Animated.View
                style = { [
                    styles.sheetSurface,
                    { transform: [ { translateY } ] }
                ] as ViewStyle[] }>
                <View
                    { ...handlers }
                    style = { styles.grabberZone as ViewStyle }>
                    <View style = { styles.grabber as ViewStyle } />
                </View>
                <View style = { styles.body as ViewStyle }>
                    <View style = { styles.header as ViewStyle }>
                        <View style = { styles.headerIcon as ViewStyle }>
                            <Icon
                                color = { S2S_V2_COLORS.accent }
                                size = { 20 }
                                src = { IconTranslate } />
                        </View>
                        <View style = { styles.headerCopy as ViewStyle }>
                            <Text style = { styles.title as TextStyle }>
                                { t('s2sV2.popup.title') }
                            </Text>
                            <Text style = { styles.description as TextStyle }>
                                { t('s2sV2.popup.description') }
                            </Text>
                        </View>
                    </View>

                    <Text style = { styles.fieldLabel as TextStyle }>
                        { t('s2sV2.popup.languageLabel') }
                    </Text>
                    <S2SV2LanguageDropdown
                        accessibilityLabel = { t('s2sV2.popup.languageLabel') }
                        label = { t('s2sV2.popup.languageLabel') }
                        onSelect = { setLanguage }
                        value = { language } />

                    <View style = { styles.divider as ViewStyle } />

                    <View style = { styles.toggleRow as ViewStyle }>
                        <View style = { styles.toggleCopy as ViewStyle }>
                            <Text style = { styles.toggleLabel as TextStyle }>
                                { t('s2sV2.popup.suppressLabel') }
                            </Text>
                            <Text style = { styles.fieldHelper as TextStyle }>
                                { suppress
                                    ? t('s2sV2.popup.suppressOnHelper')
                                    : t('s2sV2.popup.suppressOffHelper') }
                            </Text>
                        </View>
                        <Switch
                            checked = { suppress }
                            onChange = { toggle } />
                    </View>

                    <View style = { styles.actions as ViewStyle }>
                        <Pressable
                            accessibilityLabel = { t('s2sV2.popup.dismiss') }
                            accessibilityRole = 'button'
                            onPress = { dismiss }
                            style = { [ styles.button, styles.buttonDismiss ] as ViewStyle[] }>
                            <Text style = { [ styles.buttonLabel, styles.buttonLabelDismiss ] as TextStyle[] }>
                                { t('s2sV2.popup.dismiss') }
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel = { t('s2sV2.popup.proceed') }
                            accessibilityRole = 'button'
                            onPress = { proceed }
                            style = { [ styles.button, styles.buttonPrimary ] as ViewStyle[] }>
                            <Text style = { [ styles.buttonLabel, styles.buttonLabelPrimary ] as TextStyle[] }>
                                { t('s2sV2.popup.proceed') }
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </BottomSheet>
    );
}
