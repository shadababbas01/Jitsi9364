import React, { PureComponent } from 'react';

import { IconConnectionInactive } from '../../../base/icons/svg';
import IconVideoOffParticipant from '../../../base/icons/svg/video-off.svg';
import BaseIndicator from '../../../base/react/components/native/BaseIndicator';

interface IProps {

    /**
     * Status to render for the participant video.
     */
    status: 'low-bandwidth' | 'muted';
}

const LOW_BANDWIDTH_ICON_STYLE = {
    color: '#F3B95F'
};

/**
 * Thumbnail badge for displaying participant video status.
 */
export default class VideoStatusIndicator extends PureComponent<IProps> {
    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     */
    override render() {
        const { status } = this.props;

        return (
            <BaseIndicator
                icon = { status === 'muted' ? IconVideoOffParticipant : IconConnectionInactive }
                iconStyle = { status === 'low-bandwidth' ? LOW_BANDWIDTH_ICON_STYLE : undefined } />
        );
    }
}
