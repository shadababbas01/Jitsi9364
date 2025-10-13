import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { createBreakoutRoomsEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { moveToRoom } from '../../actions';
import { Text, TouchableHighlight, View, ViewStyle } from 'react-native';

import styles from './styles';

/**
 * Button to leave a breakout rooms.
 *
 * @returns {JSX.Element} - The leave breakout room button.
 */
const LeaveBreakoutRoomButton = () => {
    const dispatch = useDispatch();

    const onLeave = useCallback(() => {
        sendAnalytics(createBreakoutRoomsEvent('leave'));
        dispatch(moveToRoom());
    }
    , [ dispatch ]);

    return (
        <View style={styles.centeredContainer}>
    <Button
        accessibilityLabel='breakoutRooms.actions.leaveBreakoutRoom'
        labelKey='breakoutRooms.actions.leaveBreakoutRoom'
        onClick={onLeave}
        style={styles.button}
        type={BUTTON_TYPES.DESTRUCTIVE} />
</View>
    );
};

export default LeaveBreakoutRoomButton;
