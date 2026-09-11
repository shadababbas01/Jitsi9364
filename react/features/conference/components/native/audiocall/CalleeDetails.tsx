import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import { getConferenceName } from '../../../../base/conference/functions';
import Icon from '../../../../base/icons/components/Icon';
import { IconE2EE } from '../../../../base/icons/svg';
import { getRemoteParticipants } from '../../../../base/participants/functions';
import ConferenceTimer from '../../ConferenceTimer';

import SquareAvatar from './SquareAvatar';
import styles from './styles';

/**
 * Maps the connection-status values the app already tracks
 * (`state['features/base/conference'].connectionStatus`) to their translation keys.
 */
const STATUS_LABEL_KEYS: { [key: string]: string; } = {
    calling: 'presenceStatus.calling',
    connected: 'presenceStatus.connected',
    connecting: 'presenceStatus.connecting',
    reconnecting: 'audioCall.labels.reconnecting',
    ringing: 'presenceStatus.ringing'
};

/**
 * The callee/room details shown on the audio-only call screen: who the call is with, its
 * connection status, and its duration.
 *
 * @returns {JSX.Element}
 */
const CalleeDetails = (): JSX.Element => {
    const { t } = useTranslation();
    const remoteParticipants = useSelector((state: IReduxState) => getRemoteParticipants(state));
    const conferenceName = useSelector((state: IReduxState) => getConferenceName(state));
    const connectionStatus = useSelector(
        (state: IReduxState) => state['features/base/conference'].connectionStatus);

    const remoteParticipantList = Array.from(remoteParticipants.values());
    const soleRemoteParticipant = remoteParticipantList.length === 1 ? remoteParticipantList[0] : undefined;

    let title = conferenceName;

    if (soleRemoteParticipant) {
        title = soleRemoteParticipant.name || conferenceName;
    } else if (remoteParticipantList.length > 1) {
        const [ firstRemoteParticipant ] = remoteParticipantList;

        title = t('audioCall.labels.andOthers', {
            count: remoteParticipantList.length - 1,
            name: firstRemoteParticipant.name || conferenceName
        });
    }

    const statusLabelKey = connectionStatus && STATUS_LABEL_KEYS[connectionStatus];

    return (
        <View style = { styles.calleeDetailsContainer as ViewStyle }>
            <View style = { styles.identityContainer as ViewStyle }>
                <Text style = { styles.calleeName }>
                    { title }
                </Text>
                <View style = { styles.encryptedRow as ViewStyle }>
                    <Icon
                        src = { IconE2EE }
                        style = { styles.encryptedIcon } />
                    <Text style = { styles.encryptedText }>
                        { t('audioCall.labels.encrypted') }
                    </Text>
                </View>
            </View>
            <View style = { styles.presenceContainer as ViewStyle }>
                <View style = { styles.avatar as ViewStyle }>
                    <SquareAvatar
                        displayName = { title }
                        participantId = { soleRemoteParticipant?.id }
                        size = { styles.avatarStyles.size } />
                </View>
                {
                    statusLabelKey && (
                        <Text style = { styles.connectionStatus }>
                            { t(statusLabelKey) }
                        </Text>
                    )
                }
                <ConferenceTimer textStyle = { styles.roomTimer } />
            </View>
        </View>
    );
};

export default CalleeDetails;
