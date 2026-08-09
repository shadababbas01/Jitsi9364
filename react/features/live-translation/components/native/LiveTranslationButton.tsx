import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getLocalMicRecorderNativeModule } from '../../../audio-extraction/functions.native';
import { translate } from '../../../base/i18n/functions';
import { IconSubtitles } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { setLiveTranslationActive } from '../../actions';
import { isLiveTranslationActive } from '../../functions.native';

interface IProps extends AbstractButtonProps {

    /**
     * Whether the live translation call is running.
     */
    _active: boolean;
}

/**
 * Turns the live translation call on and off. It sits next to the camera and chat buttons on the video screen, since it
 * is a way of taking part in the conversation rather than something buried in a menu.
 */
class LiveTranslationButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'liveTranslation.title';
    override icon = IconSubtitles;
    override label = 'liveTranslation.turnOn';
    override toggledLabel = 'liveTranslation.turnOff';

    override _handleClick() {
        this.props.dispatch(setLiveTranslationActive(!this.props._active));
    }

    override _isToggled() {
        return this.props._active;
    }
}

/**
 * Maps part of the redux state to the component's props.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    return {
        _active: isLiveTranslationActive(state),

        // Nothing can be dictated without the recorder, so the button would only ever lead to an error message.
        visible: Boolean(getLocalMicRecorderNativeModule()?.startUtteranceSession)
    };
}

export default translate(connect(_mapStateToProps)(LiveTranslationButton));
