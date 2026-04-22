import React, { useEffect } from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { setConnectionStatus } from '../../../base/conference/actions.any';
import { getParticipantCount } from '../../../base/participants/functions';

import styles from './styles';

const STATUS_TEXT_VALUES = new Set([ 'ringing', 'calling', 'connecting', 'connected', 'reconnecting' ]);
const STATUS_DISPLAY_TEXT: Record<string, string> = {
    calling: 'Calling...',
    connected: 'Connected',
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    ringing: 'Ringing...'
};

function normalizeStatus(rawStatus?: string) {
    if (!rawStatus) {
        return '';
    }

    return rawStatus.trim().replace(/\.+$/, '').toLowerCase();
}

function getDisplayStatusText(rawStatus?: string, effectiveStatus?: string) {
    const trimmedStatus = rawStatus?.trim();

    if (!trimmedStatus || !effectiveStatus || effectiveStatus === 'clear') {
        return '';
    }

    if (STATUS_TEXT_VALUES.has(effectiveStatus)) {
        return STATUS_DISPLAY_TEXT[effectiveStatus] || effectiveStatus;
    }

    return trimmedStatus;
}

export default function ConnectionStatusLabel() {
    const dispatch = useDispatch();
    const { connectionStatus, connectedTimestamp } = useSelector((state: IReduxState) => state['features/base/conference']);
    const participantCount = useSelector((state: IReduxState) => getParticipantCount(state));
    const normalizedStatus = normalizeStatus(connectionStatus);
    const shouldForceConnected = normalizedStatus === 'connecting' && participantCount >= 2;
    const effectiveStatus = shouldForceConnected ? 'connected' : normalizedStatus;
    const statusText = getDisplayStatusText(connectionStatus, effectiveStatus);

    useEffect(() => {
        if (shouldForceConnected) {
            dispatch(setConnectionStatus('connected'));
        }
    }, [ dispatch, shouldForceConnected ]);

    useEffect(() => {
        if (!connectionStatus && !connectedTimestamp) {
            return;
        }

        console.log('[connectionStatus] redux:', {
            connectionStatus,
            normalizedStatus,
            connectedTimestamp,
            participantCount,
            shouldForceConnected
        });
    }, [ connectionStatus, normalizedStatus, connectedTimestamp, participantCount, shouldForceConnected ]);

    if (!effectiveStatus || effectiveStatus === 'clear') {
        return null;
    }

    if (!statusText) {
        return null;
    }

    return (
        <View style = { styles.connectionStatusContainer as ViewStyle }>
            <Text style = { styles.connectionStatusText as TextStyle }>
                { statusText }
            </Text>
        </View>
    );
}
