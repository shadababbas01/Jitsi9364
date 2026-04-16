import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getCurrentConference, getConferenceName, getConferenceTimestamp } from '../../../base/conference/functions';
import { CONFERENCE_TIMER_ENABLED } from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import {
    getParticipantCount,
    getRemoteParticipants,
    isScreenShareParticipant
} from '../../../base/participants/functions';
import {
    getCurrentRoomId,
    getRoomsInfo,
    isInBreakoutRoom
} from '../../../breakout-rooms/functions';
import PictureInPictureButton from '../../../mobile/picture-in-picture/components/PictureInPictureButton';
import { isRoomNameEnabled } from '../../../prejoin/functions.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import ConferenceTimer from '../ConferenceTimer';

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

    if (!_visible) {
        return null;
    }

    return (
        <View
            style = { styles.titleBarWrapper as ViewStyle }>
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
        </View>
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
    const currentConference = getCurrentConference(state);
    const conferenceJoined = Boolean((currentConference as any)?.isJoined?.());
    const inBreakoutRoom = Boolean(isInBreakoutRoom(state));
    const currentRoomId = getCurrentRoomId(state);
    const roomsInfo = getRoomsInfo(state);
    const currentRoomInfo = roomsInfo.rooms.find(room => room.id === currentRoomId || room.jid === currentRoomId);
    const mainRoomInfo = roomsInfo.rooms.find(room => room.isMainRoom);
    const currentRoomParticipantCount = currentRoomInfo?.participants?.length ?? getParticipantCount(state);
    const mainRoomParticipantCount = mainRoomInfo?.participants?.length ?? 0;
    const totalParticipantsAcrossRooms = roomsInfo.rooms.reduce(
        (count, room) => count + (room.participants?.length ?? 0),
        0);
    const hasConnectedRemoteParticipant
        = Array.from(getRemoteParticipants(state).values()).some(participant => !isScreenShareParticipant(participant));
    const breakoutRoomTimerReady
        = Boolean(inBreakoutRoom && (currentRoomParticipantCount > 1 || mainRoomParticipantCount === 0));
    const otherBreakoutRoomsHaveParticipants
        = Boolean(conferenceJoined && !inBreakoutRoom && totalParticipantsAcrossRooms > currentRoomParticipantCount);
    const timerReady = breakoutRoomTimerReady || otherBreakoutRoomsHaveParticipants || hasConnectedRemoteParticipant;

    return {
        _conferenceTimerEnabled:
            Boolean(getFeatureFlag(state, CONFERENCE_TIMER_ENABLED, true)
                && !hideConferenceTimer
                && startTimestamp
                && timerReady),
        _meetingName: getConferenceName(state),
        _roomNameEnabled: isRoomNameEnabled(state),
        _visible: isToolboxVisible(state)
    };
}

export default connect(_mapStateToProps)(TitleBar);
