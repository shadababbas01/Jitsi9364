import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, TextStyle, View, ViewStyle } from 'react-native';
import { connect, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import {
    AUDIO_DEVICE_BUTTON_ENABLED,
    TOGGLE_CAMERA_BUTTON_ENABLED
} from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import { getParticipantCountForDisplay } from '../../../base/participants/functions';
import ParticipantsPaneButton from '../../../participants-pane/components/native/ParticipantsPaneButton';
import { isParticipantsPaneEnabled } from '../../../participants-pane/functions';
import ToggleCameraButton from '../../../toolbox/components/native/ToggleCameraButton';
import RaiseHandButton from '../../../toolbox/components/native/RaiseHandButton';
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
    const visibility = useRef(new Animated.Value(_visible ? 1 : 0)).current;
    const raisedHandsCount = useSelector((state: IReduxState) =>
        (state['features/base/participants'].raisedHandsQueue || []).length);
    const showRaisedHandsCount = raisedHandsCount > 0;
    const participantsCount = useSelector(getParticipantCountForDisplay);
    const showParticipantsCount = participantsCount > 0;

    useEffect(() => {
        Animated.timing(visibility, {
            toValue: _visible ? 1 : 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
        }).start();
    }, [ _visible, visibility ]);

    const animatedStyle = useMemo(() => ({
        opacity: visibility,
        transform: [
            {
                translateX: visibility.interpolate({
                    inputRange: [ 0, 1 ],
                    outputRange: [ 36, 0 ]
                })
            }
        ]
    }), [ visibility ]);

    return (
        <Animated.View
            pointerEvents = { _visible ? 'box-none' : 'none' }
            style = { [ styles.sideToolbar, animatedStyle ] as ViewStyle[] }>
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
                {raisedHandsCount > 0 && (
                    <View style = { styles.sideToolbarButtonWrapper as ViewStyle }>
                        <View style = { styles.sideToolbarButtonBadgeWrapper as ViewStyle }>
                            <RaiseHandButton styles = { styles.sideToolbarButtonRaiseHand } />

                            {showRaisedHandsCount && (
                                <View
                                    pointerEvents = 'none'
                                    style = { styles.sideToolbarBadge as ViewStyle }>
                                    <Text style = { styles.sideToolbarBadgeText as ViewStyle }>
                                        {raisedHandsCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </Animated.View>
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
