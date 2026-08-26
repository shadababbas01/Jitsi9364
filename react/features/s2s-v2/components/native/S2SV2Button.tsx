import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconTranslate } from '../../../base/icons/svg';
import { isLocalParticipantModerator } from '../../../base/participants/functions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import {
    setS2SV2LanguagePopupVisible,
    setS2SV2StopConfirmVisible,
    startS2SV2Session
} from '../../actions';
import { isS2SV2Active } from '../../functions';

interface IProps extends AbstractButtonProps {

    /**
     * Whether a session is running.
     */
    _active: boolean;
}

/**
 * Turns a translated session on and off for the whole meeting.
 *
 * Shown to moderators only, in either state, because starting and stopping a session is a moderator's to do. Hiding it
 * from everybody else is a courtesy rather than a rule: what actually stops a non-moderator from starting a session is
 * that the middleware refuses to start one without the role, whatever this button does.
 *
 * A press is the whole of asking for a session. The middleware makes the identifier, records the session here and
 * announces it to the meeting; the sheet which opens afterwards settles nothing the other participants can see.
 */
class S2SV2Button extends AbstractButton<IProps> {
    override accessibilityLabel = 's2sV2.toolsMenu.enable';
    override icon = IconTranslate;
    override label = 's2sV2.toolsMenu.enable';
    override toggledAccessibilityLabel = 's2sV2.toolsMenu.disable';
    override toggledLabel = 's2sV2.toolsMenu.disable';

    /**
     * Starts a session, or asks before ending one.
     *
     * The session begins on the press, which is what announces it to the rest of the meeting: everybody else is told
     * the moment a session is asked for rather than whenever this moderator finishes answering a sheet, and a sheet
     * turned down no longer leaves a meeting that was never told anything.
     *
     * The sheet still follows, asking which language this moderator listens in - the same question, in the same sheet,
     * that everybody else answers once they have been told about the session. Like theirs, turning it down leaves the
     * session running and changes only what this device hears.
     *
     * Ending asks first, because what it takes away is everybody else's.
     *
     * @returns {void}
     */
    override _handleClick() {
        const { _active, dispatch } = this.props;

        if (_active) {
            dispatch(setS2SV2StopConfirmVisible(true));

            return;
        }

        dispatch(startS2SV2Session());
        dispatch(setS2SV2LanguagePopupVisible(true));
    }

    /**
     * Whether a session is running, which is what decides which of the two things this button says.
     *
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._active;
    }
}

export default translate(connect((state: IReduxState) => ({
    _active: isS2SV2Active(state),
    visible: isLocalParticipantModerator(state)
}))(S2SV2Button));
