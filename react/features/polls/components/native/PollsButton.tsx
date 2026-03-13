import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconInfo } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { arePollsDisabled } from '../../../conference/functions.any';
import { setFocusedTab } from '../../../chat/actions.any';
import { ChatTabs } from '../../../chat/constants';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { resetNbUnreadPollsMessages } from '../../actions';

/**
 * Button that opens the polls tab from the overflow menu.
 */
class PollsButton extends AbstractButton<AbstractButtonProps> {
    accessibilityLabel = 'chat.tabs.polls';
    icon = IconInfo;
    label = 'chat.tabs.polls';

    /**
     * Handles clicking / pressing the button, and opens the polls tab.
     *
     * @private
     * @returns {void}
     */
    _handleClick() {
        const { dispatch } = this.props;

        dispatch(setFocusedTab(ChatTabs.POLLS));
        dispatch(resetNbUnreadPollsMessages());
        navigate(screen.conference.chatTabs.main);
    }
}

/**
 * Maps part of the Redux state to the props of this component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    return {
        visible: !arePollsDisabled(state)
    };
}

export default translate(connect(_mapStateToProps)(PollsButton));
