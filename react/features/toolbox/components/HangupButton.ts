import _ from 'lodash';
import { connect } from 'react-redux';

import { createToolbarEvent } from '../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../analytics/functions';
import { leaveConference } from '../../base/conference/actions';
import { translate } from '../../base/i18n/functions';
import { IProps as AbstractButtonProps } from '../../base/toolbox/components/AbstractButton';
import AbstractHangupButton from '../../base/toolbox/components/AbstractHangupButton';
import {  NativeModules} from 'react-native';
import { endConference } from '../../base/conference/actions';
import { appNavigate } from '../../app/actions.native';
import { getParticipantCountRemoteOnly } from '../../base/participants/functions';

/**
 * Component that renders a toolbar button for leaving the current conference.
 *
 * @augments AbstractHangupButton
 */
class HangupButton extends AbstractHangupButton<AbstractButtonProps> {
    _hangup: Function;

    accessibilityLabel = 'toolbar.accessibilityLabel.hangup';
    label = 'toolbar.hangup';
    tooltip = 'toolbar.hangup';

    /**
     * Initializes a new HangupButton instance.
     *
     * @param {Props} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props: AbstractButtonProps) {
        super(props);

        this._hangup = _.once(() => {
            sendAnalytics(createToolbarEvent('hangup'));
            this.props.dispatch(leaveConference());
        });
    }

    /**
     * Helper function to perform the actual hangup action.
     *
     * @override
     * @protected
     * @returns {void}
     */
    _doHangup() {
        // NativeModules.NativeCallsNew.hangup();
        // this._hangup();
        if(this.props._settings.isPrivateRoom){
            sendAnalytics(createToolbarEvent('endmeeting'));
            this.props.dispatch(endConference());
            this.props.dispatch(appNavigate(undefined));
            NativeModules.NativeCallsNew.hangup();
            this._hangup();
        }else if(this.props._settings.isGroupCall && this.props._participantsCount == 1){
            sendAnalytics(createToolbarEvent('endmeeting'));
            this.props.dispatch(endConference());
            this.props.dispatch(appNavigate(undefined));
            NativeModules.NativeCallsNew.hangup();
            this._hangup();
        }else{
            NativeModules.NativeCallsNew.hangup();
            this._hangup();
        }
    }
    _getView(props) {
        if (props.children) {
            return this.props.children(this._onClick);
        } else {
            return super._getView(props);
        }
    }
}
function _mapStateToProps(state) {
    
    return {
        _settings: state['features/base/settings'],
        _participantsCount: getParticipantCountRemoteOnly(state)
    };
}

export default translate(connect(_mapStateToProps)(HangupButton));
