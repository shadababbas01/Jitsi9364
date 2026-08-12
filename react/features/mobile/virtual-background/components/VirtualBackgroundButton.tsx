import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconImage } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { navigate }
    from '../../navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../navigation/routes';
import { isVirtualBackgroundEnabled, isVirtualBackgroundSupported } from '../functions';

interface IProps extends AbstractButtonProps {

    /**
     * Whether a background is currently being composited into the local camera.
     */
    _enabled: boolean;
}

/**
 * Opens the background picker from the overflow menu.
 */
class VirtualBackgroundButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.selectBackground';
    override icon = IconImage;
    override label = 'toolbar.selectBackground';

    override _handleClick() {
        return navigate(screen.conference.virtualBackground);
    }

    override _isToggled() {
        return this.props._enabled;
    }
}

/**
 * Maps part of the Redux state to the props of this component.
 *
 * @param {IReduxState} state - The Redux state.
 * @param {AbstractButtonProps} ownProps - The properties explicitly passed to the component
 * instance.
 * @private
 * @returns {Object}
 */
function _mapStateToProps(state: IReduxState, ownProps: Partial<AbstractButtonProps>) {
    const supported = isVirtualBackgroundSupported(state);
    const { visible = supported } = ownProps;

    return {
        _enabled: isVirtualBackgroundEnabled(state),
        visible
    };
}

export default translate(connect(_mapStateToProps)(VirtualBackgroundButton));
