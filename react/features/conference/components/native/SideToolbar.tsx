import React from 'react';
import { View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import {
    AUDIO_DEVICE_BUTTON_ENABLED,
    TOGGLE_CAMERA_BUTTON_ENABLED
} from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import ParticipantsPaneButton from '../../../participants-pane/components/native/ParticipantsPaneButton';
import { isParticipantsPaneEnabled } from '../../../participants-pane/functions';
import ToggleCameraButton from '../../../toolbox/components/native/ToggleCameraButton';
import ZoomButton from '../../../toolbox/components/native/ZoomButton';
import { isToolboxVisible } from '../../../toolbox/functions.native';

import styles from './styles';
import ChatButton from '../../../chat/components/native/ChatButton';

interface IProps {
    _audioDeviceButtonEnabled: boolean;
    _isParticipantsPaneEnabled: boolean;
    _toggleCameraButtonEnabled: boolean;
    _visible: boolean;
}

const SideToolbar = (props: IProps) => {
    const {
        _audioDeviceButtonEnabled,
        _isParticipantsPaneEnabled,
        _toggleCameraButtonEnabled,
        _visible
    } = props;

    if (!_visible) {
        return null;
    }

    return (
        <View
            pointerEvents = 'box-none'
            style = { styles.sideToolbar as ViewStyle }>
            <View style = { styles.sideToolbarStack as ViewStyle }>
                {
                    _isParticipantsPaneEnabled
                    && <View style = { styles.sideToolbarButtonWrapper as ViewStyle }>
                        <ParticipantsPaneButton styles = { styles.sideToolbarButton } />
                    </View>
                }
                {
                    _toggleCameraButtonEnabled
                    && <View style = { styles.sideToolbarButtonWrapper as ViewStyle }>
                        <ToggleCameraButton styles = { styles.sideToolbarButton } />
                    </View>
                }
                {
                    _audioDeviceButtonEnabled
                    && <View style = { styles.sideToolbarButtonWrapper as ViewStyle }>
                        <ChatButton styles = { styles.sideToolbarButton } />
                    </View>
                }
            </View>
        </View>
    );
};

function _mapStateToProps(state: IReduxState) {
    return {
        _audioDeviceButtonEnabled: getFeatureFlag(state, AUDIO_DEVICE_BUTTON_ENABLED, true),
        _isParticipantsPaneEnabled: isParticipantsPaneEnabled(state),
        _toggleCameraButtonEnabled: getFeatureFlag(state, TOGGLE_CAMERA_BUTTON_ENABLED, true),
        _visible: isToolboxVisible(state)
    };
}

export default connect(_mapStateToProps)(SideToolbar);
