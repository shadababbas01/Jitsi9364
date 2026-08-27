import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideSheet } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconSubtitles } from '../../../base/icons/svg';
import { isLocalParticipantModerator } from '../../../base/participants/functions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import {
    setS2SV2LanguagePopupVisible,
    setS2SV2PanelVisible,
    setS2SV2StopConfirmVisible,
    startS2SV2Session
} from '../../actions';
import { S2S_V2_MODE_CAPTIONS } from '../../constants';
import { getS2SV2State, isS2SV2CaptionsActive, isS2SV2SpeechActive } from '../../functions';

interface IProps extends AbstractButtonProps {

    /**
     * Whether a captions session is running.
     */
    _active: boolean;

    /**
     * Whether the local participant may start or end one.
     */
    _moderator: boolean;

    /**
     * Whether the transcript panel is on screen.
     */
    _open: boolean;
}

/**
 * Turns live captions on and off for the whole meeting.
 *
 * The same session as a translated call and the same pipeline underneath it - every device transcribes its own
 * microphone, the room is sent English text, and each listener's device translates that into the language they picked.
 * What a captions session leaves out is the last step: nothing is read aloud, and no participant's volume is touched.
 * Which of the two a session is travels with the session, so a room running captions is running captions on every
 * device in it rather than on whichever ones happened to press this.
 *
 * A moderator's to start and to stop, exactly as a translated session is, because it starts a microphone on everybody's
 * device. Somebody who is not a moderator sees this row only while a session is running, and then it is their way back
 * to a transcript they put away.
 */
class S2SV2CaptionsButton extends AbstractButton<IProps> {
    override accessibilityLabel = 's2sV2.captions.toolsMenu.enable';
    override icon = IconSubtitles;
    override label = 's2sV2.captions.toolsMenu.enable';

    /**
     * Starts captions, asks before ending them, or shows the transcript again for somebody who cannot do either.
     *
     * @returns {void}
     */
    override _handleClick() {
        const { _active, _moderator, _open, dispatch } = this.props;

        if (_active) {
            if (_moderator) {
                // Ending takes the captions away from everybody in the room, so it asks first. The confirmation is a
                // sheet of its own and replaces this menu, which is why the row does not also close it.
                dispatch(setS2SV2StopConfirmVisible(true));

                return;
            }

            // For everybody else the row is the way back to a transcript they put away. Nothing replaces this menu in
            // that case, so it takes itself down - a panel opened underneath a sheet still covering it is no use.
            dispatch(setS2SV2PanelVisible(!_open));
            dispatch(hideSheet());

            return;
        }

        // The meeting is told the moment a session is asked for rather than when this moderator finishes answering the
        // sheet, so a sheet turned down no longer leaves a session nobody was told about.
        dispatch(startS2SV2Session(S2S_V2_MODE_CAPTIONS));
        dispatch(setS2SV2LanguagePopupVisible(true));
    }

    /**
     * Which of the four things the row is currently for.
     *
     * @private
     * @returns {string}
     */
    _key() {
        const { _active, _moderator, _open } = this.props;

        if (!_active) {
            return 's2sV2.captions.toolsMenu.enable';
        }

        if (_moderator) {
            return 's2sV2.captions.toolsMenu.disable';
        }

        return _open ? 's2sV2.captions.sideToolbar.hide' : 's2sV2.captions.sideToolbar.show';
    }

    /**
     * What the row says.
     *
     * @returns {string}
     */
    override _getLabel() {
        return this._key();
    }

    /**
     * What a screen reader is told the row will do.
     *
     * @returns {string}
     */
    override _getAccessibilityLabel() {
        return this._key();
    }

    /**
     * Whether captions are running, which is what decides which of the things above the row says.
     *
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._active;
    }
}

export default translate(connect((state: IReduxState) => {
    const active = isS2SV2CaptionsActive(state);

    return {
        _active: active,
        _moderator: isLocalParticipantModerator(state),
        _open: getS2SV2State(state).showPanel,

        // There is one session at a time, so this row is not offered while a translated one is running: it could not
        // start a second and stopping the other one from a row which says "captions" would be the wrong control ending
        // the wrong thing. Otherwise it is there for a moderator, who can start and stop, and for everybody else only
        // while captions are running, when it is their way back to the transcript.
        visible: !isS2SV2SpeechActive(state) && (active || isLocalParticipantModerator(state))
    };
})(S2SV2CaptionsButton));
