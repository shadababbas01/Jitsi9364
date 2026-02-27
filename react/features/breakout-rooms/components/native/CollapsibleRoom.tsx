import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, NativeModules, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { createBreakoutRoomsEvent } from '../../../analytics/AnalyticsEvents';
import { openSheet } from '../../../base/dialog/actions';
import { sendAnalytics } from '../../../analytics/functions';
import CollapsibleList from '../../../participants-pane/components/native/CollapsibleList';
import { getBreakoutRoomsConfig, getCurrentRoomId } from '../../functions';
import { moveToRoom } from '../../actions';
import { IRoom } from '../../types';

import BreakoutRoomContextMenu from './BreakoutRoomContextMenu';
import BreakoutRoomParticipantItem from './BreakoutRoomParticipantItem';
import styles from './styles';

interface IProps {

    /**
     * Room to display.
     */
    room: IRoom;

    roomId: string;
}

/**
 * Returns a key for a passed item of the list.
 *
 * @param {Object} item - The participant.
 * @returns {string} - The user ID.
 */
function _keyExtractor(item: any) {
    return item.jid;
}

export const CollapsibleRoom = ({ room, roomId }: IProps) => {
    const dispatch = useDispatch();
    const currentRoomId = useSelector(getCurrentRoomId);
    const { hideJoinRoomButton } = useSelector(getBreakoutRoomsConfig);
    const { t } = useTranslation();
    const _openContextMenu = useCallback(() => {
        dispatch(openSheet(BreakoutRoomContextMenu, { room }));
    }, [ room ]);
    const onJoinRoom = useCallback(() => {
        NativeModules.NativeCallsNew?.switchingRoom?.(true);
        NativeModules.OpenMelpChat?.switchingRoom?.(true);
        sendAnalytics(createBreakoutRoomsEvent('join'));
        dispatch(moveToRoom(room.jid));
    }, [ dispatch, room ]);

    const joinAction = useMemo(() => {
        if (hideJoinRoomButton || currentRoomId === room.id) {
            return null;
        }

        return (
            <TouchableOpacity
                onPress = { onJoinRoom }
                style = { styles.joinButton }>
                <Text style = { styles.joinButtonText }>
                    { t('breakoutRooms.actions.join') }
                </Text>
            </TouchableOpacity>
        );
    }, [ hideJoinRoomButton, currentRoomId, room.id, onJoinRoom, t ]);
    const roomParticipantsNr = Object.values(room.participants || {}).length;
    const title
        = `${room.name
    || t('breakoutRooms.mainRoom')} (${roomParticipantsNr})`;

    return (
        <View style={{ marginHorizontal: 23 }}>
        <CollapsibleList
            onLongPress = { _openContextMenu }
            rightAction = { joinAction }
            title = { title }>
            <FlatList
                data = { Object.values(room.participants || {}) }
                keyExtractor = { _keyExtractor }

                /* @ts-ignore */
                listKey = { roomId as String }

                // eslint-disable-next-line react/jsx-no-bind, no-confusing-arrow
                renderItem = { ({ item: participant }) => (
                    <BreakoutRoomParticipantItem
                        item = { participant }
                        room = { room } />
                ) }
                scrollEnabled = { false }
                showsHorizontalScrollIndicator = { false }
                windowSize = { 2 } />
        </CollapsibleList>
        </View>
    );
};
