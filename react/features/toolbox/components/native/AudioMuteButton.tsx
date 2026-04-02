import { connect } from 'react-redux';

import { translate } from '../../../base/i18n/functions';
import { IconMicSlashRed } from '../../../base/icons/svg';
import AbstractAudioMuteButton, {
    IProps as AbstractAudioMuteButtonProps,
    mapStateToProps
} from '../AbstractAudioMuteButton';

interface IProps extends AbstractAudioMuteButtonProps {
    isToolboxButton?: boolean;
}

class AudioMuteButton extends AbstractAudioMuteButton<IProps> {
    /**
     * Use the red mic-slash icon only for the toolbox button when muted.
     *
     * @override
     * @returns {Function}
     */
    override _getIcon() {
        if (this._isToggled() && this.props.isToolboxButton) {
            return IconMicSlashRed;
        }

        return super._getIcon();
    }
}

export default translate(connect(mapStateToProps)(AudioMuteButton));
