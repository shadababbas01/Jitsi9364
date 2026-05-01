import React, { useEffect, useState } from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { setConnectionStatus } from '../../../base/conference/actions.any';
import { getParticipantCount } from '../../../base/participants/functions';

import styles from './styles';

const CONNECTED_LABEL_MS = 1000;
const E2EE_LABEL_MS = 1000;
const E2EE_LABEL_TEXT = 'End to end encrypted';
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
    const dispatch = useDispatch();
    const { connectionStatus, connectedTimestamp } = useSelector((state: IReduxState) => state['features/base/conference']);
    const participantCount = useSelector((state: IReduxState) => getParticipantCount(state));
    const normalizedStatus = normalizeStatus(connectionStatus);
    const [ forcedConnectedTimestamp, setForcedConnectedTimestamp ] = useState<number | undefined>(undefined);
    const [ now, setNow ] = useState(Date.now());

    const shouldForceConnected = normalizedStatus === 'connecting' && participantCount >= 2;
    const effectiveStatus = shouldForceConnected ? 'connected' : normalizedStatus;
    const effectiveConnectedTimestamp = effectiveStatus === 'connected'
        ? (connectedTimestamp ?? forcedConnectedTimestamp)
        : undefined;

    useEffect(() => {
        if (shouldForceConnected) {
            dispatch(setConnectionStatus('connected'));
        }
    }, [ dispatch, shouldForceConnected ]);

    useEffect(() => {
        if (shouldForceConnected) {
            setForcedConnectedTimestamp(prev => prev ?? Date.now());

            return;
        }

        if (forcedConnectedTimestamp) {
            setForcedConnectedTimestamp(undefined);
        }
    }, [ shouldForceConnected, forcedConnectedTimestamp ]);

    useEffect(() => {
        if (effectiveStatus !== 'connected' || !effectiveConnectedTimestamp) {
            return;
        }

        const elapsed = Math.max(0, now - effectiveConnectedTimestamp);
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
    }, [ effectiveStatus, effectiveConnectedTimestamp, now ]);

    if (!effectiveStatus || effectiveStatus === 'clear') {
        return null;
    }

    if (!STATUS_TEXT_VALUES.has(effectiveStatus)) {
        return null;
    }

    let statusText = STATUS_DISPLAY_TEXT[effectiveStatus] || effectiveStatus;

    if (effectiveStatus === 'connected' && effectiveConnectedTimestamp) {
        const elapsed = Math.max(0, now - effectiveConnectedTimestamp);

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
