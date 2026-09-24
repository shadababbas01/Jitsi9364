// @flow

import React, { Component } from 'react';
import { NativeModules, Platform } from 'react-native';
import { connect } from 'react-redux';
import { translate } from '../../../base/i18n/functions';
import { MEDIA_TYPE } from '../../../base/media/constants';
import { setAudioMuted } from '../../../base/media/actions';
import { isLocalTrackMuted } from '../../../base/tracks/functions.any';


/**
 *  Function which says if platform is iOS or not.
 *
 */
function isPlatformiOS(): boolean {
    return Platform.OS === 'ios';
}

const { AudioMode } = NativeModules;

class CustomAudioMuteButton extends Component {
    _prevAudioMuted = null;

    _isAudioMuted = () => {
        return this.props._audioMuted;
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
        const { _audioMuted } = this.props;

        if (this._prevAudioMuted != null && this._prevAudioMuted !== undefined) {
            this._setAudioMuted(this._prevAudioMuted);
        } else {
            this._setAudioMuted(!_audioMuted);
        }
    };

    render() {
        if (this.props.children) {
            return this.props.children(this._isAudioMuted(), this._onClick);
        }
        return null;
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