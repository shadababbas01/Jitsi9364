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

    _onClick;
    _isAudioMuted;
    _setSpeakerOn;
    _isHoldDisabled;
    _prevAudioMuted;
    _prevSpeakerOn;

    constructor(props){
        super(props);
        // this._onClick= this._onClick.bind(this);
        // this._isAudioMuted = this._isAudioMuted.bind(this);
        // this._setSpeakerOn = this._setSpeakerOn.bind(this);
    }


    _isAudioMuted = () => {
        return this.props._audioMuted;
    }

    _onClick = () => {
            const {_audioMuted, speakerOn, setHoldState, isHoldOn} = this.props;
            const isHoldDisabled = this._isHoldDisabled();
            if(!isHoldOn){
                this._prevAudioMuted = _audioMuted;
                this._prevSpeakerOn =  speakerOn;
                this._setAudioMuted(true);
                // this._setSpeakerOn(false);
            }else{
                if(this._prevAudioMuted!=null && this._prevAudioMuted!=undefined){
                    this._setAudioMuted(this._prevAudioMuted);    
                }else{
                this._setAudioMuted(false);
                } if(this._prevSpeakerOn!=null && this._prevSpeakerOn!=undefined){
                    this._setSpeakerOn(this._prevSpeakerOn);
                }else{
                    this._setSpeakerOn(true);
                }
            }

            if(AudioMode.onHold){
                AudioMode.onHold(!isHoldDisabled);
            }
              
           setHoldState(!isHoldOn);
        this.props.dispatch(participantUpdated({
            // XXX Only the local participant is allowed to update without
            // stating the JitsiConference instance (i.e. participant property
            // `conference` for a remote participant) because the local
            // participant is uniquely identified by the very fact that there is
            // only one local participant.

            id: participantid,
            local: true
        }));

           
           

           
    }


    _isHoldDisabled = () => {
        const {_audioMuted, speakerOn} = this.props;
        const isHoldDisabled = !(_audioMuted && !speakerOn)
        return isHoldDisabled;
    }

    _setSpeakerOn = (speakerOn) => {
        if(AudioMode.setSpeakerOn){
            AudioMode.setSpeakerOn(speakerOn)
                .then((val)=>{
                    this.props.setSpeakerState(speakerOn)
                })
                .catch(err=>{

                });
        }
    }

    /**
     * Changes the muted state.
     *
     * @param {boolean} audioMuted - Whether audio should be muted or not.
     * @protected
     * @returns {void}
     */
    _setAudioMuted(audioMuted: boolean) {
       // sendAnalytics(createToolbarEvent(AUDIO_MUTE, { enable: audioMuted }));
        this.props.dispatch(setAudioMuted(audioMuted, /* ensureTrack */ true));

        // FIXME: The old conference logic as well as the shared video feature
        // still rely on this event being emitted.
        typeof APP === 'undefined'
            || APP.UI.emitEvent(UIEvents.AUDIO_MUTED, audioMuted, true);
    }

    render() {
        if(this.props.children){
            return this.props.children(this._onClick, this._isHoldDisabled());
        }
    }
}


function _mapStateToProps(state): Object {
    const tracks = state['features/base/tracks'];
    const localParticipant = getLocalParticipant(state);
    participantid = localParticipant.id;

    return {
        _audioMuted: isLocalTrackMuted(tracks, MEDIA_TYPE.AUDIO),
        _disabled: state['features/base/config'].startSilent
    };
}

export default translate(connect(_mapStateToProps)(HoldButton));


