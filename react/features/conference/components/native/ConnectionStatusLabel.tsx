import React, { useEffect, useState } from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';

import styles from './styles';

const CONNECTED_LABEL_MS = 1000;
const E2EE_LABEL_MS = 1000;
const E2EE_LABEL_TEXT = 'End to end encrypted';
const STATUS_TEXT_VALUES = new Set([ 'ringing', 'calling', 'connecting', 'connected' ]);
const STATUS_DISPLAY_TEXT: Record<string, string> = {
    calling: 'Calling...',
    connected: 'Connected',
    connecting: 'Connecting...',
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

    useEffect(() => {
        if (!connectionStatus && !connectedTimestamp) {
            return;
        }

        console.log('[connectionStatus] redux:', {
            connectionStatus,
            normalizedStatus,
            connectedTimestamp
        });
    }, [ connectionStatus, normalizedStatus, connectedTimestamp ]);

    useEffect(() => {
        if (normalizedStatus !== 'connected' || !connectedTimestamp) {
            return;
        }

        const elapsed = Math.max(0, now - connectedTimestamp);
        let delay: number | null = null;

        if (elapsed < CONNECTED_LABEL_MS) {
            delay = CONNECTED_LABEL_MS - elapsed;
        } else if (elapsed < CONNECTED_LABEL_MS + E2EE_LABEL_MS) {
            delay = CONNECTED_LABEL_MS + E2EE_LABEL_MS - elapsed;
        }

        if (delay === null) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setNow(Date.now());
        }, delay);

        return () => clearTimeout(timeoutId);
    }, [ normalizedStatus, connectedTimestamp, now ]);

    if (!normalizedStatus || normalizedStatus === 'clear') {
        return null;
    }

    if (!STATUS_TEXT_VALUES.has(normalizedStatus)) {
        return null;
    }

    let statusText = STATUS_DISPLAY_TEXT[normalizedStatus] || normalizedStatus;

    if (normalizedStatus === 'connected' && connectedTimestamp) {
        const elapsed = Math.max(0, now - connectedTimestamp);

        if (elapsed >= CONNECTED_LABEL_MS + E2EE_LABEL_MS) {
            return null;
        }

        statusText = elapsed >= CONNECTED_LABEL_MS
            ? E2EE_LABEL_TEXT
            : STATUS_DISPLAY_TEXT.connected;
    }

    return (
        <View style = { styles.connectionStatusContainer as ViewStyle }>
            <Text style = { styles.connectionStatusText as TextStyle }>
                { statusText }
            </Text>
        </View>
    );
}
