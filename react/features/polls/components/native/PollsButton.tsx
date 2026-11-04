import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconPoll } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { setFocusedTab } from '../../../chat/actions.any';
import { ChatTabs } from '../../../chat/constants';
import { arePollsDisabled } from '../../../conference/functions.any';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { iAmVisitor } from '../../../visitors/functions';
import { resetNbUnreadPollsMessages } from '../../actions';

/**
 * Button that opens the polls screen from the overflow menu.
 *
 * Opening it is never capped: the polls already in the meeting can always be read and voted on. The plan's poll
 * quota is enforced where a poll is created, on the Create a poll button (AbstractPollsPane) and on submit
 * (AbstractPollCreate).
 */
class PollsButton extends AbstractButton<AbstractButtonProps> {
    override accessibilityLabel = 'chat.tabs.polls';
    override icon = IconPoll;
    override label = 'chat.tabs.polls';

    /**
     * Handles clicking / pressing the button, and opens the polls screen.
     *
     * @private
     * @returns {void}
     */
    override _handleClick() {
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
        visible: !arePollsDisabled(state) && !iAmVisitor(state)
    };
}

export default translate(connect(_mapStateToProps)(PollsButton));
