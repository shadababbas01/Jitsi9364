import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import styles from '../../../s2s-v2/components/native/styles';
import { setCaptionsStopConfirmVisible, setRequestingSubtitles } from '../../actions.any';

/**
 * Asks for confirmation before live captions are stopped for everyone.
 *
 * @returns {JSX.Element}
 */
export default function DisableLiveCaptionsDialog() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const language = useSelector((state: IReduxState) => state['features/subtitles']._language);

    const cancel = useCallback(() => {
        dispatch(setCaptionsStopConfirmVisible(false));
    }, [ dispatch ]);

    const confirm = useCallback(() => {
        dispatch(setCaptionsStopConfirmVisible(false));
        dispatch(setRequestingSubtitles(false, false, language));
    }, [ dispatch, language ]);

    return (
        <BottomSheet
            addScrollViewPadding = { false }
            onCancel = { cancel }
            style = { styles.sheet }>
            <View style = { styles.grabber as ViewStyle } />
            <View style = { styles.body as ViewStyle }>
                <Text style = { styles.title as TextStyle }>
                    { t('liveCaptionsPanel.stopDialog.title') }
                </Text>
                <Text style = { styles.description as TextStyle }>
                    { t('liveCaptionsPanel.stopDialog.description') }
                </Text>

                <View style = { styles.actions as ViewStyle }>
                    <Pressable
                        accessibilityLabel = { t('liveCaptionsPanel.stopDialog.cancel') }
                        accessibilityRole = 'button'
                        onPress = { cancel }
                        style = { [ styles.button, styles.buttonDismiss ] as ViewStyle[] }>
                        <Text style = { [ styles.buttonLabel, styles.buttonLabelDismiss ] as TextStyle[] }>
                            { t('liveCaptionsPanel.stopDialog.cancel') }
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel = { t('liveCaptionsPanel.stopDialog.confirm') }
                        accessibilityRole = 'button'
                        onPress = { confirm }
                        style = { [ styles.button, styles.buttonDestructive ] as ViewStyle[] }>
                        <Text style = { [ styles.buttonLabel, styles.buttonLabelPrimary ] as TextStyle[] }>
                            { t('liveCaptionsPanel.stopDialog.confirm') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </BottomSheet>
    );
}
