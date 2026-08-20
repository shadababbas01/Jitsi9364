import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { IconTranslate, IconVolumeUp } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { setLiveTranslationUntranslated } from '../../actions';
import { isLiveTranslationActive, isParticipantUntranslated } from '../../functions.any';

interface IProps extends AbstractButtonProps {

    /**
     * Whether this participant is currently being heard in their own voice.
     */
    _untranslated: boolean;

    /**
     * The ID of the participant this button was opened for.
     */
    participantID: string;
}

/**
 * A remote video menu button which chooses whether one participant is heard in their own voice or read out in
 * translation.
 *
 * The choice is per participant and per listener, because that is how a multilingual meeting actually works: somebody
 * who speaks the language a participant is speaking does not want a translation read over the top of it, while the
 * person sitting next to them does. Nothing is announced, and nothing changes for anybody else in the meeting.
 */
class HearOriginalVoiceButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'liveTranslation.hearOriginal';
    override icon = IconVolumeUp;
    override label = 'liveTranslation.hearOriginal';
    override toggledIcon = IconTranslate;
    override toggledLabel = 'liveTranslation.hearTranslated';

    /**
     * Switches this participant between their own voice and the translation.
     *
     * @returns {void}
     */
    override _handleClick() {
        const { _untranslated, dispatch, participantID } = this.props;

        dispatch(setLiveTranslationUntranslated(participantID, !_untranslated));
    }

    /**
     * Whether this participant is being heard untranslated, which is what the button then offers to undo.
     *
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._untranslated;
    }
}

/**
 * Maps part of the redux state to the props of this component.
 *
 * @param {IReduxState} state - The redux state.
 * @param {IProps} ownProps - The own props of the component.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    return {
        _untranslated: isParticipantUntranslated(state, ownProps.participantID),

        // Outside a translated call nothing is being read out in the first place, so there is nothing to choose between.
        visible: isLiveTranslationActive(state)
    };
}

export default translate(connect(_mapStateToProps)(HearOriginalVoiceButton));
