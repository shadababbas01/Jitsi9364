import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconTranslate } from '../../../base/icons/svg';
import { getParticipantCount, isLocalParticipantModerator } from '../../../base/participants/functions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import {
    setS2SV2LanguagePopupVisible,
    setS2SV2PanelVisible,
    startS2SV2Session
} from '../../actions';
import { MAX_S2S_V2_PARTICIPANTS } from '../../constants';
import { getS2SV2State, isS2SV2Active } from '../../functions';

interface IProps extends AbstractButtonProps {

    /**
     * Whether a session is running.
     */
    _active: boolean;

    /**
     * Whether the local participant may start one.
     */
    _moderator: boolean;

    /**
     * Whether the panel is on screen.
     */
    _open: boolean;
}

/**
 * The way in and out of a translated session from the video screen.
 *
 * What it does depends on whether there is a session to be in. With one running it shows the panel and hides it again,
 * for everybody: this is the only way back to a panel which has been put away, and without it a listener who dismissed
 * it would have no route back short of the moderator ending the session and starting another. With no session running
 * it starts one, which is a moderator's to do and is why it is only shown to them in that state.
 *
 * Starting happens on the press, exactly as it does from the tools menu: the meeting is told a session has begun the
 * moment one is asked for, rather than whenever this moderator finishes answering the sheet that follows.
 *
 * Deliberately not a way to end a session, even for a moderator. Stopping one takes the translation away from
 * everybody in the room, which is not something a single tap on the video screen should be able to do by accident - it
 * lives in the tools menu, behind a confirmation.
 */
class S2SV2PanelButton extends AbstractButton<IProps> {
    override accessibilityLabel = 's2sV2.toolsMenu.enable';
    override icon = IconTranslate;
    override label = 's2sV2.toolsMenu.enable';

    /**
     * Shows the panel, hides it, or starts a session and then asks which language to listen in.
     *
     * @returns {void}
     */
    override _handleClick() {
        const { _active, _open, dispatch } = this.props;

        if (_active) {
            dispatch(setS2SV2PanelVisible(!_open));

            return;
        }

        // Only a moderator ever sees the button in this state, and the middleware refuses to start a session without
        // the role in any case, so there is nothing to check here that is not already checked.
        dispatch(startS2SV2Session());
        dispatch(setS2SV2LanguagePopupVisible(true));
    }

    /**
     * Which of the three things the button is currently for.
     *
     * @private
     * @returns {string}
     */
    _key() {
        const { _active, _open } = this.props;

        if (!_active) {
            return 's2sV2.toolsMenu.enable';
        }

        return _open ? 's2sV2.sideToolbar.hide' : 's2sV2.sideToolbar.show';
    }

    /**
     * The label, which the side toolbar does not draw but assistive technology reads.
     *
     * @returns {string}
     */
    override _getLabel() {
        return this._key();
    }

    /**
     * What a screen reader is told the button will do.
     *
     * @returns {string}
     */
    override _getAccessibilityLabel() {
        return this._key();
    }

    /**
     * Lit while the panel is on screen, so the icon says whether the conversation is showing rather than whether a
     * session is running - which is what the tap changes.
     *
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._open;
    }
}

export default translate(connect((state: IReduxState) => {
    const active = isS2SV2Active(state);

    return {
        _active: active,
        _moderator: isLocalParticipantModerator(state),
        _open: getS2SV2State(state).showPanel,
        visible: getParticipantCount(state) <= MAX_S2S_V2_PARTICIPANTS
            && (active || isLocalParticipantModerator(state)),

        // With a session running everybody needs the way back to the panel, whether or not their device can speak into
        // it: a participant who can only listen is still in the session. With no session running there is nothing to
        // show, so the button is only there for somebody who can start one.
        visible: active || isLocalParticipantModerator(state)
    };
})(S2SV2PanelButton));
