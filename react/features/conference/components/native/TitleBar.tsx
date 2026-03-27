import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getConferenceName, getConferenceTimestamp } from '../../../base/conference/functions';
import { CONFERENCE_TIMER_ENABLED } from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import PictureInPictureButton from '../../../mobile/picture-in-picture/components/PictureInPictureButton';
import { isRoomNameEnabled } from '../../../prejoin/functions.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import ConferenceTimer from '../ConferenceTimer';

import Labels from './Labels';
import styles from './styles';

import ConnectionStatusLabel from '../../../conference/components/native/ConnectionStatusLabel';

interface IProps {

    /**
     * Whether displaying the current conference timer is enabled or not.
     */
    _conferenceTimerEnabled: boolean;

    /**
     * Creates a function to be invoked when the onPress of the touchables are
     * triggered.
     */
    _createOnPress: Function;

    /**
     * Name of the meeting we're currently in.
     */
    _meetingName: string;

    /**
     * Whether displaying the current room name is enabled or not.
     */
    _roomNameEnabled: boolean;

    /**
     * True if the navigation bar should be visible.
     */
    _visible: boolean;
}

/**
 * Implements a navigation bar component that is rendered on top of the
 * conference screen.
 *
 * @param {IProps} props - The React props passed to this component.
 * @returns {JSX.Element}
 */
const TitleBar = (props: IProps) => {
    const { _visible } = props;
    const visibility = useRef(new Animated.Value(_visible ? 1 : 0)).current;

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
                translateY: visibility.interpolate({
                    inputRange: [ 0, 1 ],
                    outputRange: [ -24, 0 ]
                })
            }
        ]
    }), [ visibility ]);

    return (
        <Animated.View
            pointerEvents = { _visible ? 'box-none' : 'none' }
            style = { [ styles.titleBarWrapper, animatedStyle ] as ViewStyle[] }>
            <View style = { styles.titleBarLeft as ViewStyle }>
                <PictureInPictureButton styles = { styles.titleBarRoundButton } />
            </View>
            <View
                pointerEvents = 'box-none'
                style = { styles.titleBarCenter as ViewStyle }>
                {
                    props._roomNameEnabled
                    && <Text
                        numberOfLines = { 1 }
                        style = { styles.meetingName }>
                        { props._meetingName }
                    </Text>
                }
                <ConnectionStatusLabel />
                {
                    props._conferenceTimerEnabled
                    && <ConferenceTimer textStyle = { styles.meetingTimer } />
                }
                <View style = { styles.titleBarLabels as ViewStyle }>
                    {/* eslint-disable-next-line react/jsx-no-bind */}
                    {/* <Labels createOnPress = { props._createOnPress } /> */}
                </View>
            </View>
            <View style = { styles.titleBarRightSpacer as ViewStyle } />
        </Animated.View>
    );
};

/**
 * Maps part of the Redux store to the props of this component.
 *
 * @param {Object} state - The Redux state.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const { hideConferenceTimer } = state['features/base/config'];
    const startTimestamp = getConferenceTimestamp(state);

    return {
        _conferenceTimerEnabled:
            Boolean(getFeatureFlag(state, CONFERENCE_TIMER_ENABLED, true) && !hideConferenceTimer && startTimestamp),
        _meetingName: getConferenceName(state),
        _roomNameEnabled: isRoomNameEnabled(state),
        _visible: isToolboxVisible(state)
    };
}

export default connect(_mapStateToProps)(TitleBar);
