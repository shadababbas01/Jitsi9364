import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconMicSlashRed } from '../../../base/icons/svg';
import { setLiveTranslationMic } from '../../../live-translation/actions';
import { getLiveTranslationState } from '../../../live-translation/functions.native';
import AbstractAudioMuteButton, {
    IProps as AbstractAudioMuteButtonProps,
    mapStateToProps as abstractMapStateToProps
} from '../AbstractAudioMuteButton';

interface IProps extends AbstractAudioMuteButtonProps {

    /**
     * Whether the live translation call is running.
     */
    _liveTranslationActive: boolean;

    /**
     * Whether the microphone the live translation call listens through is open.
     */
    _liveTranslationMicOn: boolean;
    isToolboxButton?: boolean;
}

/**
 * The meeting microphone button.
 *
 * While the live translation call is running it stands for that call's microphone instead. The conference microphone
 * stays muted throughout - what the local participant says reaches the others as a translated message read out on their
 * side, and letting their own voice through as well would say everything twice - so this is the microphone the local
 * user actually has, and the one button has to control.
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

    /**
     * Indicates if the microphone this button stands for is muted.
     *
     * @override
     * @protected
     * @returns {boolean}
     */
    override _isAudioMuted() {
        if (this.props._liveTranslationActive) {
            return !this.props._liveTranslationMicOn;
        }

        return super._isAudioMuted();
    }

    /**
     * Opens or closes the microphone this button stands for.
     *
     * @param {boolean} audioMuted - Whether the microphone should be closed.
     * @override
     * @protected
     * @returns {void}
     */
    override _setAudioMuted(audioMuted: boolean) {
        if (this.props._liveTranslationActive) {
            // Deliberately not touching the conference microphone: it is muted for as long as the translated call runs.
            this.props.dispatch(setLiveTranslationMic(!audioMuted));

            return;
        }

        super._setAudioMuted(audioMuted);
    }
}

/**
 * Maps parts of the redux state to the component's props.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const { active, micOn } = getLiveTranslationState(state);

    return {
        ...abstractMapStateToProps(state),
        _liveTranslationActive: active,
        _liveTranslationMicOn: micOn
    };
}

export default translate(connect(_mapStateToProps)(AudioMuteButton));
