import { connect } from 'react-redux';

import { translate } from '../../../../base/i18n/functions';
import { IconMicSlashBlack } from '../../../../base/icons/svg';
import AbstractAudioMuteButton, {
    IProps,
    mapStateToProps
} from '../../../../toolbox/components/AbstractAudioMuteButton';

/**
 * The mute button for the audio-call screen: same behaviour as the regular toolbox mute button,
 * but using a dark (rather than red) icon variant when toggled, to match the white active-state
 * circle used on this screen.
 */
class MuteButton extends AbstractAudioMuteButton<IProps> {
    override toggledIcon = IconMicSlashBlack;
}

export default translate(connect(mapStateToProps)(MuteButton));
