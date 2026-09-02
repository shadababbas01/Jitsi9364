import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch } from 'react-redux';

import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import { setS2SV2StopConfirmVisible, stopS2SV2Session } from '../../actions';

import styles from './styles';

/**
 * Asks the moderator to confirm before the session ends for everybody.
 *
 * Worth asking, because the cost of the mistake is not the moderator's: everybody else in the meeting loses the
 * translation they are following, and whoever was speaking finds out by nobody understanding them.
 *
 * @returns {JSX.Element}
 */
export default function DisableS2SV2Dialog() {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const cancel = useCallback(() => {
        dispatch(setS2SV2StopConfirmVisible(false));
    }, [ dispatch ]);

    const confirm = useCallback(() => {
        dispatch(setS2SV2StopConfirmVisible(false));
        dispatch(stopS2SV2Session());
    }, [ dispatch ]);

    return (
        <BottomSheet
            addScrollViewPadding = { false }
            onCancel = { cancel }
            style = { styles.sheet }>
            <View style = { styles.grabber as ViewStyle } />
            <View style = { styles.body as ViewStyle }>
                <Text style = { styles.title as TextStyle }>
                    { t('s2sV2.stopDialog.title') }
                </Text>
                <Text style = { styles.description as TextStyle }>
                    { t('s2sV2.stopDialog.description') }
                </Text>

                <View style = { styles.actions as ViewStyle }>
                    <Pressable
                        accessibilityLabel = { t('s2sV2.stopDialog.cancel') }
                        accessibilityRole = 'button'
                        onPress = { cancel }
                        style = { [ styles.button, styles.buttonDismiss ] as ViewStyle[] }>
                        <Text
                            adjustsFontSizeToFit = { true }
                            allowFontScaling = { false }
                            minimumFontScale = { 0.75 }
                            numberOfLines = { 1 }
                            style = { [ styles.buttonLabel, styles.buttonLabelDismiss ] as TextStyle[] }>
                            { t('s2sV2.stopDialog.cancel') }
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel = { t('s2sV2.stopDialog.confirm') }
                        accessibilityRole = 'button'
                        onPress = { confirm }
                        style = { [ styles.button, styles.buttonDestructive ] as ViewStyle[] }>
                        <Text
                            adjustsFontSizeToFit = { true }
                            allowFontScaling = { false }
                            minimumFontScale = { 0.75 }
                            numberOfLines = { 1 }
                            style = { [ styles.buttonLabel, styles.buttonLabelPrimary ] as TextStyle[] }>
                            { t('s2sV2.stopDialog.confirm') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </BottomSheet>
    );
}
