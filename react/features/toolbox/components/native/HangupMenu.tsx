import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { createToolbarEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import { appNavigate } from '../../../app/actions';
import { IReduxState } from '../../../app/types';
import ColorSchemeRegistry from '../../../base/color-scheme/ColorSchemeRegistry';
import { endConference } from '../../../base/conference/actions';
import { hideSheet } from '../../../base/dialog/actions';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import { PARTICIPANT_ROLE } from '../../../base/participants/constants';
import { getLocalParticipant, getParticipantCount } from '../../../base/participants/functions';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { isInBreakoutRoom } from '../../../breakout-rooms/functions';

function HangupMenu() {
    const dispatch = useDispatch();
    const _styles: any = useSelector((state: IReduxState) => ColorSchemeRegistry.get(state, 'Toolbox'));

    const inBreakoutRoom = useSelector(isInBreakoutRoom);
    const isModerator = useSelector((state: IReduxState) =>
        getLocalParticipant(state)?.role === PARTICIPANT_ROLE.MODERATOR);
    const participantCount = useSelector((state: IReduxState) => getParticipantCount(state));
    const isAlone = participantCount <= 2;

    const { DESTRUCTIVE, SECONDARY } = BUTTON_TYPES;

    const handleEndConference = useCallback(() => {
        dispatch(hideSheet());
        sendAnalytics(createToolbarEvent('endmeeting'));
        dispatch(endConference());
    }, [ dispatch ]);

    const handleLeaveConference = useCallback(() => {
        dispatch(hideSheet());
        sendAnalytics(createToolbarEvent('hangup'));
        dispatch(appNavigate(undefined));
    }, [ dispatch ]);

    // ✅ Auto-leave if user is not a moderator and alone
    useEffect(() => {
        if ( !isModerator) {
            handleLeaveConference();
        }
    }, [ isAlone, isModerator, handleLeaveConference ]);

    // 🔒 If alone and not moderator, don't render anything (already auto left)
    if (!isModerator && isAlone) {
        return null;
    }

    return (
        <BottomSheet>
            <View style={_styles.hangupMenuContainer}>
            {
    isModerator && !inBreakoutRoom ? (
        <>
            <Button
                accessibilityLabel='toolbar.endConference'
                labelKey='toolbar.endConference'
                onClick={handleEndConference}
                style={_styles.hangupButton}
                type={DESTRUCTIVE}
            />
            <Button
                accessibilityLabel='toolbar.leaveConference'
                labelKey='toolbar.leaveConference'
                onClick={handleLeaveConference}
                style={_styles.hangupButton}
                type={SECONDARY}
            />
        </>
    ) : (
        // Show leave button only for moderator in breakout OR non-moderator in main room
        isModerator || (!isModerator && !inBreakoutRoom) ? (
            <Button
                accessibilityLabel='toolbar.leaveConference'
                labelKey='toolbar.leaveConference'
                onClick={handleLeaveConference}
                style={_styles.hangupButton}
                type={SECONDARY}
            />
        ) : null
    )
}


            </View>
        </BottomSheet>
    );
}

export default HangupMenu;
