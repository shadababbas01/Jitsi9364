import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { createBreakoutRoom } from '../../actions';
import { Text, TouchableHighlight, View, ViewStyle } from 'react-native';
import styles from './styles';

/**
 * Button to add a breakout room.
 *
 * @returns {JSX.Element} - The add breakout room button.
 */
const AddBreakoutRoomButton = () => {
    const dispatch = useDispatch();

    const onAdd = useCallback(() =>
        dispatch(createBreakoutRoom())
    , [ dispatch ]);

    return (
        <View style={styles.centeredContainer}>
        <Button
            accessibilityLabel = 'breakoutRooms.actions.add'
            labelKey = 'breakoutRooms.actions.add'
            onClick = { onAdd }
            style = { styles.breakoutroombutton }
            type = { BUTTON_TYPES.SECONDARY } />
            </View>
    );
};

export default AddBreakoutRoomButton;
