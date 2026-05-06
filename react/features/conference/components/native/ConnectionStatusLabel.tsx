import React, { useEffect, useState } from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
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

export default function ConnectionStatusLabel() {
    const { connectionStatus, connectedTimestamp } = useSelector((state: IReduxState) => state['features/base/conference']);
    const normalizedStatus = normalizeStatus(connectionStatus);
    const [ now, setNow ] = useState(Date.now());
    const effectiveStatus = normalizedStatus;
    const effectiveConnectedTimestamp = effectiveStatus === 'connected' ? connectedTimestamp : undefined;

    useEffect(() => {
        if (effectiveStatus !== 'connected' || !effectiveConnectedTimestamp) {
            return;
        }

        const intervalId = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [ effectiveStatus, effectiveConnectedTimestamp ]);

    if (!effectiveStatus || effectiveStatus === 'clear') {
        return null;
    }

    if (!STATUS_TEXT_VALUES.has(effectiveStatus)) {
        return null;
    }

    let statusText = STATUS_DISPLAY_TEXT[effectiveStatus] || effectiveStatus;

    if (effectiveStatus === 'connected' && effectiveConnectedTimestamp) {
        const totalSeconds = Math.max(0, Math.floor((now - effectiveConnectedTimestamp) / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        statusText = hours > 0
            ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return (
        <View style = { styles.connectionStatusContainer as ViewStyle }>
            <Text style = { styles.connectionStatusText as TextStyle }>
                { statusText }
            </Text>
        </View>
    );
}
