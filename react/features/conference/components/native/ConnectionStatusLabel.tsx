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
    const [ connectedPhase, setConnectedPhase ] = useState<'connected' | 'e2ee' | 'hidden' | null>(null);

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
        if (normalizedStatus !== 'connected') {
            setConnectedPhase(null);
            return;
        }

        setConnectedPhase('connected');

        const toE2ee = setTimeout(() => {
            setConnectedPhase('e2ee');
        }, CONNECTED_LABEL_MS);

        const toHidden = setTimeout(() => {
            setConnectedPhase('hidden');
        }, CONNECTED_LABEL_MS + E2EE_LABEL_MS);

        return () => {
            clearTimeout(toE2ee);
            clearTimeout(toHidden);
        };
    }, [ normalizedStatus, connectedTimestamp ]);

    if (!normalizedStatus || normalizedStatus === 'clear') {
        return null;
    }

    if (!STATUS_TEXT_VALUES.has(normalizedStatus)) {
        return null;
    }

    if (normalizedStatus === 'connected' && connectedPhase === 'hidden') {
        return null;
    }

    const statusText = normalizedStatus === 'connected'
        ? (connectedPhase === 'e2ee' ? E2EE_LABEL_TEXT : STATUS_DISPLAY_TEXT.connected)
        : (STATUS_DISPLAY_TEXT[normalizedStatus] || normalizedStatus);

    return (
        <View style = { styles.connectionStatusContainer as ViewStyle }>
            <Text style = { styles.connectionStatusText as TextStyle }>
                { statusText }
            </Text>
        </View>
    );
}
