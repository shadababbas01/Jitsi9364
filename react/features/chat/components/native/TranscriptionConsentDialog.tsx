import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import ConfirmDialog
    from '../../../base/dialog/components/native/ConfirmDialog';
import { appNavigate } from '../../../app/actions.native';
import { IReduxState } from '../../../app/types';
import { getLocalParticipant } from '../../../base/participants/functions';
import { dismissTranscriptionConsent } from '../../actions.any';

const TranscriptionConsentDialog = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const chatState = useSelector((state: IReduxState) => state['features/chat']);
    const localParticipant = useSelector(getLocalParticipant);

    const {
        showTranscriptionConsent,
        transcriptionModeratorName,
        transcriptionStarterId,
        transcriptionStartedByCurrentUser,
        consentDismissedForSession
    } = chatState;

    const handleContinue = useCallback(() => {
        dispatch(dismissTranscriptionConsent());
    }, [ dispatch ]);

    const handleLeave = useCallback(() => {
        dispatch(dismissTranscriptionConsent());
        dispatch(appNavigate(undefined));
    }, [ dispatch ]);

    if (!showTranscriptionConsent
        || consentDismissedForSession
        || transcriptionStartedByCurrentUser) {
        return null;
    }

    if (transcriptionStarterId && localParticipant?.id === transcriptionStarterId) {
        return null;
    }

    const moderatorName
        = transcriptionModeratorName ?? t('transcriptionConsent.defaultModeratorName');

    return (
        <ConfirmDialog
            cancelLabel = 'transcriptionConsent.leaveCall'
            confirmLabel = 'transcriptionConsent.continue'
            descriptionKey = {{
                key: 'transcriptionConsent.liveCaptionsNotice',
                params: { moderatorName }
            }}
            onCancel = { handleLeave }
            onSubmit = { handleContinue }
            title = 'transcriptionConsent.title' />
    );
};

export default TranscriptionConsentDialog;