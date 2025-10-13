import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import InputDialog from '../../../base/dialog/components/native/InputDialog';
import { IBreakoutRoomNamePromptProps as IProps } from '../../../participants-pane/types';
import { renameBreakoutRoom } from '../../actions';

import { Alert } from 'react-native';


/**
 * Implements a component to render a breakout room name prompt.
 *
 * @param {IProps} props - The props of the component.
 * @returns {JSX.Element}
 */
export default function BreakoutRoomNamePrompt({ breakoutRoomJid, initialRoomName }: IProps) {
    const dispatch = useDispatch();

    const onSubmit = useCallback((roomName: string) => {
        // Prevent empty or unchanged names
        const trimmedName = roomName.trim();
        if (!trimmedName || trimmedName === initialRoomName?.trim()) {
            return false;
        }

        // Dispatch rename action with comprehensive error handling
        dispatch(renameBreakoutRoom(breakoutRoomJid, trimmedName))
            .then(() => {
                // Success feedback
                console.error('Rename Success in Component', error);
                // Alert.alert('Success', 'Breakout room renamed successfully');
                return true;
            })
            .catch((error) => {
                console.error('Rename Failed in Component', error);
                // Alert.alert('Error', error.message || 'Failed to rename breakout room');
                return false;
            });

        return true;
    }, [breakoutRoomJid, initialRoomName, dispatch]);

    return (
        <InputDialog
            descriptionKey='dialog.renameBreakoutRoomTitle'
            initialValue={initialRoomName?.trim()}
            onSubmit={onSubmit}
        />
    );
}
