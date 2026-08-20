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

/**
 * The meeting microphone button.
 *
 * There is one microphone and one button for it, in a translated call as much as outside one: the local participant is
 * heard by the meeting in their own voice and dictated for translation from the same open microphone, so muting has to
 * stop both. The live translation middleware mirrors this into the dictation state, which catches every other way of
 * being muted as well.
 */
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
