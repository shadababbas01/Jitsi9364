/* eslint-disable @typescript-eslint/no-use-before-define, react-native/no-color-literals */
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { dismissTranscriptionConsent } from '../../actions.any';

/**
 * Native consent notice shown when another participant starts live captions.
 *
 * @returns {React.ReactElement | null} The dialog or null.
 */
export default function TranscriptionConsentDialog() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const showConsentPopup = useSelector((state: IReduxState) =>
        Boolean(state['features/chat'].showTranscriptionConsent));
    const transcriptionModeratorName = useSelector((state: IReduxState) =>
        state['features/chat'].transcriptionModeratorName);
    const transcriptionStartedByCurrentUser = useSelector((state: IReduxState) =>
        Boolean(state['features/chat'].transcriptionStartedByCurrentUser));

    const onDismiss = useCallback(() => {
        dispatch(dismissTranscriptionConsent());
    }, [ dispatch ]);

    if (!showConsentPopup || transcriptionStartedByCurrentUser) {
        return null;
    }

    const displayName = transcriptionModeratorName || t('transcriptionConsent.defaultModeratorName');

    return (
        <Modal
            animationType = 'fade'
            onRequestClose = { onDismiss }
            statusBarTranslucent = { true }
            transparent = { true }
            visible = { true }>
            <View style = { styles.backdrop }>
                <View
                    accessibilityViewIsModal = { true }
                    style = { styles.card }>
                    <Text style = { styles.title }>
                        { t('transcriptionConsent.title') }
                    </Text>
                    <Text style = { styles.description }>
                        { t('transcriptionConsent.liveCaptionsNotice', { moderatorName: displayName }) }
                    </Text>
                    <Pressable
                        accessibilityRole = 'button'
                        onPress = { onDismiss }
                        style = { styles.action }>
                        <Text
                            maxFontSizeMultiplier = { 1.2 }
                            style = { styles.actionText }
                            textBreakStrategy = 'simple'>
                            { t('dialog.Ok') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    action: { alignSelf: 'flex-end', justifyContent: 'center', marginTop: 16, minHeight: 44, minWidth: 64, paddingHorizontal: 12 },
    actionText: { color: '#169689', fontSize: 16, fontWeight: '600', lineHeight: 22, paddingHorizontal: 2, textAlign: 'center' },
    backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', flex: 1, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 6, maxWidth: 520, padding: 24, width: '100%' },
    description: { color: '#727272', flexShrink: 1, fontSize: 18, lineHeight: 28, marginTop: 16 },
    title: { color: '#212121', flexShrink: 1, fontSize: 22, fontWeight: '500', lineHeight: 30 }
});
