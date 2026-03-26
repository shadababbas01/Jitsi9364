import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import Dialog from '../../base/ui/components/web/Dialog';
import { openURLInBrowser } from '../../base/util/openURLInBrowser.web';
import { resolveUpgradePlansUrl } from '../functions';

const callLimitImage = require('../../../../images/callLimitImage.png');
const imageStyle = {
    borderRadius: 12,
    display: 'block',
    margin: '0 auto 16px',
    maxWidth: '100%',
    width: '100%'
};

interface IProps {
    message: string;
    title: string;
}

const MeetingLimitDialog = ({ message, title }: IProps) => {
    const upgradePlansUrl = useSelector((state: IReduxState) =>
        resolveUpgradePlansUrl(state['features/base/config']?.upgradePlansUrl));
    const handleSubmit = useCallback(() => {
        upgradePlansUrl && openURLInBrowser(upgradePlansUrl, true);
    }, [ upgradePlansUrl ]);

    return (
        <Dialog
            cancel = {{ translationKey: 'Remind me later' }}
            ok = {{ hidden: false, translationKey: 'Upgrade' }}
            onSubmit = { handleSubmit }
            title = { title }>
            <img
                alt = ''
                src = { callLimitImage }
                style = { imageStyle } />
            <p>{ message }</p>
        </Dialog>
    );
};

export default MeetingLimitDialog;
