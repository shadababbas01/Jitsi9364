import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';

import styles from './styles';

const TIMER_TICK_MS = 1000;
const STATUS_TEXT_VALUES = new Set([ 'ringing', 'calling', 'connecting', 'connected' ]);

function normalizeStatus(rawStatus?: string) {
    if (!rawStatus) {
        return '';
    }

    return rawStatus.trim().replace(/\.+$/, '').toLowerCase();
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ConnectionStatusLabel() {
    const { connectionStatus, connectedTimestamp } = useSelector((state: IReduxState) => state['features/base/conference']);
    const normalizedStatus = normalizeStatus(connectionStatus);
    const [ tick, setTick ] = useState(0);

    const elapsedSeconds = useMemo(() => {
        if (!connectedTimestamp || normalizedStatus !== 'connected') {
            return 0;
        }

        return Math.max(0, Math.floor((Date.now() - connectedTimestamp) / 1000));
    }, [ connectedTimestamp, normalizedStatus, tick ]);

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

        const intervalId = setInterval(() => {
            setTick(current => current + 1);
        }, TIMER_TICK_MS);

        return () => clearInterval(intervalId);
    }, [ normalizedStatus, connectedTimestamp ]);

    if (!normalizedStatus || normalizedStatus === 'clear') {
        return null;
    }

    if (!STATUS_TEXT_VALUES.has(normalizedStatus)) {
        return null;
    }

    return (
        <View style = { styles.connectionStatusContainer as ViewStyle }>
            <Text style = { styles.connectionStatusText as TextStyle }>
                { normalizedStatus }
            </Text>
            { normalizedStatus === 'connected' && (
                <Text style = { styles.connectionStatusText as TextStyle }>
                    { formatDuration(elapsedSeconds) }
                </Text>
            ) }
        </View>
    );
}
