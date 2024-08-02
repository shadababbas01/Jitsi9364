import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { useSelector } from 'react-redux';

import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import { isLocalParticipantModerator } from '../../../base/participants/functions';

import LobbyParticipantList from './LobbyParticipantList';
import MeetingParticipantList from './MeetingParticipantList';
import ParticipantsPaneFooter from './ParticipantsPaneFooter';
import VisitorsList from './VisitorsList';
import styles from './styles';


//----------->>>>>> All components are defined in different sub files.
//----------->>>>>> Previously all components were defined in ParticipantsPane file only.

/**
 * Participants pane.
 *
 * @returns {React$Element<any>}
 */
const ParticipantsPane = () => {
    const isLocalModerator = useSelector(isLocalParticipantModerator);
    const keyExtractor
        = useCallback((e: undefined, i: number) => i.toString(), []);

    return (
        <JitsiScreen
            footerComponent = { isLocalModerator ? ParticipantsPaneFooter : undefined }
            style = { styles.participantsPaneContainer }>

            { /* Fixes warning regarding nested lists */ }
            <FlatList

                // eslint-disable-next-line react/jsx-no-bind
                ListHeaderComponent = { () => (
                    <>
                        <VisitorsList />
                        <LobbyParticipantList />
                        <MeetingParticipantList />
 {/* Below line previously in this file but in 9364 it wasmoved to Breakout rooms */}
    {/* const { remote,fakeParticipants, sortedRemoteVirtualScreenshareParticipants } = useSelector((state: IReduxState) => state['features/base/participants']);
    const remoteUsers = remote.size - fakeParticipants.size - sortedRemoteVirtualScreenshareParticipants.size;
    const showAddBreakoutRoom = useSelector(isAddBreakoutRoomButtonVisible) && remoteUsers > 2; */}
                    </>
                ) }
                data = { [] as ReadonlyArray<undefined> }
                keyExtractor = { keyExtractor }
                renderItem = { null }
                windowSize = { 2 } />
        </JitsiScreen>
    );
};

export default ParticipantsPane;
