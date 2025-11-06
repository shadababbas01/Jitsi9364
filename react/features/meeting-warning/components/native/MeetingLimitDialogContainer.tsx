import React, { useCallback } from 'react';
import { Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideMeetingLimitDialog } from '../../../chat/actions.native';

import MeetingLimitDialog from './MeetingLimitDialog';

const MeetingLimitDialogContainer = () => {
    const dispatch = useDispatch();
    const meetingLimitDialog = useSelector((state: IReduxState) =>
        state['features/chat'].meetingLimitDialog ?? { open: false }
    );
    const domain = useSelector((state: IReduxState) =>
        state['features/base/config']?.hosts?.domain
    );

    const onDismiss = useCallback(() => {
        dispatch(hideMeetingLimitDialog());
    }, [ dispatch ]);

    const onUpgrade = useCallback(() => {
        const fallback = 'https://meet.melp.us';
        const base = domain ? `https://${domain}` : fallback;
        const target = `${base}/spa/payment-page#plans`;

        Linking.openURL(target).catch(() => undefined);
        dispatch(hideMeetingLimitDialog());
    }, [ dispatch, domain ]);

    const visible = Boolean(meetingLimitDialog?.open);

    if (!visible) {
        return null;
    }

    return (
        <MeetingLimitDialog
            message = { meetingLimitDialog?.message }
            onRemindLater = { onDismiss }
            onUpgrade = { onUpgrade }
            title = { meetingLimitDialog?.title }
            visible = { visible } />
    );
};

export default MeetingLimitDialogContainer;