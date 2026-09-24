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
import { ASPECT_RATIO_WIDE } from '../../../base/responsive-ui/constants';
import ParticipantsPaneButton from '../../../participants-pane/components/native/ParticipantsPaneButton';
import { isParticipantsPaneEnabled } from '../../../participants-pane/functions';
import S2SV2PanelButton from '../../../s2s-v2/components/native/S2SV2PanelButton';
import { MAX_S2S_V2_PARTICIPANTS } from '../../../s2s-v2/constants';
import { isS2SV2Active } from '../../../s2s-v2/functions';
import ToggleCameraButton from '../../../toolbox/components/native/ToggleCameraButton';
import RaiseHandButton from '../../../toolbox/components/native/RaiseHandButton';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { getParticipantCount, isLocalParticipantModerator } from '../../../base/participants/functions';

import styles from './styles';
import ChatButton from '../../../chat/components/native/ChatButton';

interface IProps {
    _audioDeviceButtonEnabled: boolean;
    _isParticipantsPaneEnabled: boolean;
    _showS2SV2Button: boolean;
    _toggleCameraButtonEnabled: boolean;
    _visible: boolean;
}

const SideToolbar = (props: IProps) => {
    const {
        _audioDeviceButtonEnabled,
        _isParticipantsPaneEnabled,
        _showS2SV2Button,
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
    }, [_visible, visibility]);

    const animatedStyle = useMemo(() => ({
        opacity: visibility,
        transform: [
            {
                translateX: visibility.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0]
                })
            }
        ]
    }), [visibility]);

    const { aspectRatio } = useSelector((state: IReduxState) => state['features/base/responsive-ui']);
    const isLandscape = aspectRatio === ASPECT_RATIO_WIDE;

    const sideToolbarButton = isLandscape ? {
        iconStyle: {
            ...styles.sideToolbarButton.iconStyle,
            fontSize: 18
        },
        style: {
            ...styles.sideToolbarButton.style,
            height: 42,
            width: 42,
            borderRadius: 26
        },
        underlayColor: 'transparent'
    } : styles.sideToolbarButton;

    const sideToolbarButtonRaiseHand = isLandscape ? {
        iconStyle: {
            ...styles.sideToolbarButtonRaiseHand.iconStyle,
            fontSize: 15
        },
        style: {
            ...styles.sideToolbarButtonRaiseHand.style,
            borderRadius: 18
        },
        underlayColor: 'transparent'
    } : styles.sideToolbarButtonRaiseHand;

    const sideToolbarButtonWrapper = isLandscape ? {
        ...styles.sideToolbarButtonWrapper,
        marginBottom: 6
    } : styles.sideToolbarButtonWrapper;

    const sideToolbarButtonBadgeWrapper = isLandscape ? {
        ...styles.sideToolbarButtonBadgeWrapper,
        height: 36,
        width: 44,
        borderRadius: 18
    } : styles.sideToolbarButtonBadgeWrapper;

    return (
        <Animated.View
            pointerEvents={_visible ? 'box-none' : 'none'}
            style={[styles.sideToolbar, isLandscape && { top: 12, right: 8 }, animatedStyle] as ViewStyle[]}>
            <View style={styles.sideToolbarStack as ViewStyle}>
                {
                    _isParticipantsPaneEnabled
                    && <View style={sideToolbarButtonWrapper as ViewStyle}>
                        <ParticipantsPaneButton styles={sideToolbarButton} />
                    </View>
                }
                {
                    _toggleCameraButtonEnabled
                    && <View style={sideToolbarButtonWrapper as ViewStyle}>
                        <ToggleCameraButton styles={sideToolbarButton} />
                    </View>
                }
                {
                    _audioDeviceButtonEnabled
                    && <View style={sideToolbarButtonWrapper as ViewStyle}>
                        <ChatButton styles={sideToolbarButton} />
                    </View>
                }
                {_showS2SV2Button && (
                    <View style={sideToolbarButtonWrapper as ViewStyle}>
                        <S2SV2PanelButton styles={sideToolbarButton} />
                    </View>
                )}
                {raisedHandsCount > 0 && (
                    <View style={sideToolbarButtonWrapper as ViewStyle}>
                        <View style={sideToolbarButtonBadgeWrapper as ViewStyle}>
                            <RaiseHandButton styles={sideToolbarButtonRaiseHand} />

                            {showRaisedHandsCount && (
                                <View
                                    pointerEvents='none'
                                    style={styles.sideToolbarBadge as ViewStyle}>
                                    <Text style={styles.sideToolbarBadgeText as ViewStyle}>
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
        _showS2SV2Button: getParticipantCount(state) <= MAX_S2S_V2_PARTICIPANTS
            && (isS2SV2Active(state) || isLocalParticipantModerator(state)),
        _toggleCameraButtonEnabled: getFeatureFlag(state, TOGGLE_CAMERA_BUTTON_ENABLED, true),
        _visible: isToolboxVisible(state)
    };
}

export default connect(_mapStateToProps)(SideToolbar);
