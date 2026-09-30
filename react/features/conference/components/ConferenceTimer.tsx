import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import { getLocalizedDurationFormatter } from '../../base/i18n/dateUtil';

import { ConferenceTimerDisplay } from './index';

/**
 * The type of the React {@code Component} props of {@link ConferenceTimer}.
 */
interface IProps {

    /**
     * Whether the timer should only be shown after the connection is established.
     */
    onlyWhenConnected?: boolean;

    /**
     * Style to be applied to the rendered text.
     */
    textStyle?: Object;
}

export interface IDisplayProps {

    /**
     * Style to be applied to text (native only).
     */
    textStyle?: Object;

    /**
     * String to display as time.
     */
    timerValue: string;
}

const ConferenceTimer = ({ onlyWhenConnected = false, textStyle }: IProps) => {
    const { connectionStatus } = useSelector(
        (state: IReduxState) => state['features/base/conference']);
    const timerTimestamp = useSelector(
        (state: IReduxState) => state['features/base/conference'].connectedTimestamp);
    const effectiveTimestamp = onlyWhenConnected && connectionStatus !== 'connected'
        ? undefined
        : timerTimestamp;
    const [ timerValue, setTimerValue ] = useState(getLocalizedDurationFormatter(0));
    const interval = useRef<number>();

    /**
     * Sets the current state values that will be used to render the timer.
     *
     * @param {number} refValueUTC - The initial UTC timestamp value.
     * @param {number} currentValueUTC - The current UTC timestamp value.
     *
     * @returns {void}
     */
    const setStateFromUTC = useCallback((refValueUTC, currentValueUTC) => {
        if (!refValueUTC || !currentValueUTC) {
            return;
        }

        if (currentValueUTC < refValueUTC) {
            return;
        }

        const timerMsValue = currentValueUTC - refValueUTC;

        const localizedTime = getLocalizedDurationFormatter(timerMsValue);

        setTimerValue(localizedTime);
    }, []);

    /**
     * Start conference timer.
     *
     * @returns {void}
     */
    const startTimer = useCallback(() => {
        if (!interval.current && effectiveTimestamp) {
            setStateFromUTC(effectiveTimestamp, new Date().getTime());

            interval.current = window.setInterval(() => {
                setStateFromUTC(effectiveTimestamp, new Date().getTime());
            }, 1000);
        }
    }, [ effectiveTimestamp, interval ]);

    /**
     * Stop conference timer.
     *
     * @returns {void}
     */
    const stopTimer = useCallback(() => {
        if (interval.current) {
            clearInterval(interval.current);
            interval.current = undefined;
        }

        setTimerValue(getLocalizedDurationFormatter(0));
    }, [ interval ]);

    useEffect(() => {
        startTimer();

        return () => stopTimer();
    }, [ effectiveTimestamp ]);


    if (!effectiveTimestamp) {
        return null;
    }

    return (<ConferenceTimerDisplay
        textStyle = { textStyle }
        timerValue = { timerValue } />);
};

export default ConferenceTimer;
