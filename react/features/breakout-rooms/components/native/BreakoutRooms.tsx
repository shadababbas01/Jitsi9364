import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import { isLocalParticipantModerator, getParticipantCountRemoteOnly } from '../../../base/participants/functions';
import { equals } from '../../../base/redux/functions';
import {
    getBreakoutRooms,
    getCurrentRoomId,
    isAddBreakoutRoomButtonVisible,
    isAutoAssignParticipantsVisible,
    isInBreakoutRoom
} from '../../functions';

import AddBreakoutRoomButton from './AddBreakoutRoomButton';
import AutoAssignButton from './AutoAssignButton';
import { CollapsibleRoom } from './CollapsibleRoom';
import LeaveBreakoutRoomButton from './LeaveBreakoutRoomButton';
import styles from './styles';
import { View } from 'react-native';


const BreakoutRooms = () => {
    const currentRoomId = useSelector(getCurrentRoomId);
    const inBreakoutRoom = useSelector(isInBreakoutRoom);
    const isBreakoutRoomsSupported = useSelector((state: IReduxState) =>
        state['features/base/conference'].conference?.getBreakoutRooms()?.isSupported());
    const isLocalModerator = useSelector(isLocalParticipantModerator);
    const keyExtractor = useCallback((e: undefined, i: number) => i.toString(), []);
    // Get breakout rooms and sort by creation time (oldest first).
    // Fallbacks: created timestamp fields, numeric suffix in the name, numeric id, then 0.
    const roomsObj = useSelector(getBreakoutRooms, equals);
    const rooms = Object.values(roomsObj || {});

    const getRoomOrder = (r: any) => {
        if (!r) {
            return 0;
        }

        // Try common timestamp-like fields.
        const ts = r.timestamp ?? r.createdAt ?? r.created ?? r.creationTime ?? r.createTime;
        if (ts) {
            const n = typeof ts === 'number' ? ts : Date.parse(String(ts));
            if (!Number.isNaN(n)) {
                return n;
            }
        }

        // Fallback: numeric suffix in name (e.g. "Breakout Room 10").
        const m = String(r.name || '').match(/(\d+)(?!.*\d)/);
        if (m) {
            return Number(m[1]);
        }

        // Fallback: numeric id.
        const idNum = Number(r.id);
        if (!Number.isNaN(idNum)) {
            return idNum;
        }

        return 0;
    };

    rooms.sort((p1, p2) => getRoomOrder(p1) - getRoomOrder(p2));

    const { remote, fakeParticipants, sortedRemoteVirtualScreenshareParticipants } = useSelector((state: IReduxState) => state['features/base/participants']);
    const remoteUsers = remote.size - fakeParticipants.size - sortedRemoteVirtualScreenshareParticipants.size;
    const showAddBreakoutRoom = useSelector(isAddBreakoutRoomButtonVisible) && remoteUsers >= 0;
    const showAutoAssign = useSelector(isAutoAssignParticipantsVisible);
    console.log('Service worker registered.', currentRoomId);

    return (
        <JitsiScreen
            footerComponent = { isLocalModerator && showAddBreakoutRoom
                ? AddBreakoutRoomButton : undefined }
            style = { styles.breakoutRoomsContaineroverflowmenu }
            >

            { /* Fixes warning regarding nested lists */}
            <FlatList
                ListHeaderComponent={() => (
                    <View style={{ marginHorizontal: 0 }}>
                        {/* { showAutoAssign && <AutoAssignButton /> }     Added by Shadab   */}
                        {inBreakoutRoom && <LeaveBreakoutRoomButton />}
                        <View>
                            {/* {showAddBreakoutRoom ? <AddBreakoutRoomButton /> : null} */}
                        </View>
                        {
                            isBreakoutRoomsSupported &&
                            rooms.map(room => (
                                <CollapsibleRoom
                                    key={room.id}
                                    room={room}
                                    roomId={room.id} />
                            ))
                        }
                    </View>
                )}
                data={[] as ReadonlyArray<undefined>}
                keyExtractor={keyExtractor}
                renderItem={null}
                windowSize={2}
            />
        </JitsiScreen>
    );
};

export default BreakoutRooms;
