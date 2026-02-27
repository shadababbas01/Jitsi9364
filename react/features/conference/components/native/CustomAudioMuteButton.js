// @flow

import React, { Component } from 'react';
import { NativeModules, Platform } from 'react-native';
import { connect } from '../../../base/redux';
import { translate } from '../../../base/i18n';
import { MEDIA_TYPE, setAudioMuted } from '../../../base/media';
import { isLocalTrackMuted } from '../../../base/tracks';
import {
    AUDIO_MUTE,
    createToolbarEvent,
    sendAnalytics
} from '../../../analytics';

/**
 *  Function which says if platform is iOS or not.
 *
 */
function isPlatformiOS(): boolean {
    return Platform.OS === 'ios';
}

const { AudioMode } = NativeModules;

class CustomAudioMuteButton extends Component {

    _onClick;
    _isAudioMuted;
    _prevAudioMuted;

    constructor(props){
        super(props);
        this._onClick= this._onClick.bind(this);
        this._isAudioMuted = this._isAudioMuted.bind(this);
       
    }


    _isAudioMuted() {
        return this.props._audioMuted;
    }

    _onClick() {
            const {_audioMuted} = this.props;
           
            if(this._prevAudioMuted!=null && this._prevAudioMuted!=undefined){
                    this._setAudioMuted(this._prevAudioMuted);    
                }else{
                     this._setAudioMuted(false);
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
        sendAnalytics(createToolbarEvent(AUDIO_MUTE, { enable: audioMuted }));
        this.props.dispatch(setAudioMuted(audioMuted, /* ensureTrack */ true));

        // FIXME: The old conference logic as well as the shared video feature
        // still rely on this event being emitted.
        typeof APP === 'undefined'
            || APP.UI.emitEvent(UIEvents.AUDIO_MUTED, audioMuted, true);
    }

    render() {
        if(this.props.children){
            return this.props.children(this._onClick, this. _setAudioMuted());
        }
    }
}


function _mapStateToProps(state): Object {
    const tracks = state['features/base/tracks'];

    return {
        _audioMuted: isLocalTrackMuted(tracks, MEDIA_TYPE.AUDIO),
        _disabled: state['features/base/config'].startSilent
    };
}

export default translate(connect(_mapStateToProps)(CustomAudioMuteButton));