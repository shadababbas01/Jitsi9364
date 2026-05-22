import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from 'react-native-dialog';
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
        <Dialog.Container
            coverScreen = { false }
            visible = { true }>
            <Dialog.Title>
                { t('transcriptionConsent.title') }
            </Dialog.Title>
            <Dialog.Description>
                { t('transcriptionConsent.liveCaptionsNotice', { moderatorName: displayName }) }
            </Dialog.Description>
            <Dialog.Button
                label = { t('dialog.Ok') }
                onPress = { onDismiss } />
        </Dialog.Container>
    );
}
