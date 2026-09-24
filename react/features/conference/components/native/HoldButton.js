import React, { Component } from 'react';
import { NativeModules, Platform } from 'react-native';
import { connect } from 'react-redux';
import { translate } from '../../../base/i18n/functions';
import { MEDIA_TYPE } from '../../../base/media/constants';
import { setAudioMuted,  } from '../../../base/media/actions';
import { isLocalTrackMuted } from '../../../base/tracks/functions.any';
// import {
//     AUDIO_MUTE,
//     createToolbarEvent,
//     sendAnalytics
// } from '../../../analytics/AnalyticsEvents';
import { getLocalParticipant} from '../../../base/participants/functions';
import { participantUpdated } from '../../../base/participants/actions';





/**
 *  Function which says if platform is iOS or not.
 *
 */
function isPlatformiOS(): boolean {
    return Platform.OS === 'ios';
}

const { AudioMode } = NativeModules;
var participantid;


class HoldButton extends Component {
    _prevAudioMuted = null;
    _prevSpeakerOn = null;

    _isAudioMuted = () => {
        return this.props._audioMuted;
    };

    _isHoldDisabled = () => {
        const { _audioMuted, speakerOn } = this.props;
        const isHoldDisabled = !(_audioMuted && !speakerOn);
        return isHoldDisabled;
    };

    _setSpeakerOn = (speakerOn) => {
        if (AudioMode?.setSpeakerOn) {
            AudioMode.setSpeakerOn(speakerOn)
                .then(() => {
                    this.props.setSpeakerState?.(speakerOn);
                })
                .catch(() => {});
        }
    };

    /**
     * Changes the muted state.
     *
     * @param {boolean} audioMuted - Whether audio should be muted or not.
     * @protected
     * @returns {void}
     */
    _setAudioMuted = (audioMuted: boolean) => {
        this.props.dispatch(setAudioMuted(audioMuted, /* ensureTrack */ true));

        if (typeof APP !== 'undefined' && typeof UIEvents !== 'undefined') {
            APP.UI?.emitEvent?.(UIEvents.AUDIO_MUTED, audioMuted, true);
        }
    };

    _onClick = () => {
        const { _audioMuted, speakerOn, setHoldState, isHoldOn, dispatch, _localParticipantId } = this.props;
        const isHoldDisabled = this._isHoldDisabled();
        if (!isHoldOn) {
            this._prevAudioMuted = _audioMuted;
            this._prevSpeakerOn = speakerOn;
            this._setAudioMuted(true);
        } else {
            if (this._prevAudioMuted != null && this._prevAudioMuted !== undefined) {
                this._setAudioMuted(this._prevAudioMuted);
            } else {
                this._setAudioMuted(false);
            }
            if (this._prevSpeakerOn != null && this._prevSpeakerOn !== undefined) {
                this._setSpeakerOn(this._prevSpeakerOn);
            } else {
                this._setSpeakerOn(true);
            }
        }

        if (AudioMode?.onHold) {
            AudioMode.onHold(!isHoldDisabled);
        }

        setHoldState?.(!isHoldOn);

        const targetId = _localParticipantId || participantid;
        if (targetId) {
            dispatch(participantUpdated({
                id: targetId,
                local: true
            }));
        }
    };

    render() {
        if (this.props.children) {
            return this.props.children(this._onClick, this._isHoldDisabled());
        }
        return null;
    }
}


function _mapStateToProps(state): Object {
    const tracks = state['features/base/tracks'];
    const localParticipant = getLocalParticipant(state);
    participantid = localParticipant?.id;

    return {
        _audioMuted: isLocalTrackMuted(tracks, MEDIA_TYPE.AUDIO),
        _disabled: state['features/base/config']?.startSilent,
        _localParticipantId: localParticipant?.id
    };
}

export default translate(connect(_mapStateToProps)(HoldButton));


