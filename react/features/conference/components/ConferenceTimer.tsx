import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { getConferenceTimestamp } from '../../base/conference/functions';
import {time} from '../../base/conference/functions';
import { getLocalizedDurationFormatter } from '../../base/i18n/dateUtil';

import { ConferenceTimerDisplay } from './index';
import { getParticipantCountRemoteOnly } from '../../base/participants/functions';
// import { time } from '@tensorflow/tfjs-core';

/**
 * The type of the React {@code Component} props of {@link ConferenceTimer}.
 */
interface IProps {

    /**
     * Style to be applied to the rendered text.
     */
    textStyle?: Object;
    participant?: any;
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
    participant?: any;
}

const ConferenceTimer = ({ textStyle, participant }: IProps) => {
    
    const initialTimestamp = useSelector(getConferenceTimestamp);
    const [startTimestamp, setStartTimestamp] = useState<number | undefined>(initialTimestamp);
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
        if (!interval.current && startTimestamp) {

            console.log("start timer comes here : conference timer")
            setStateFromUTC(startTimestamp, new Date().getTime());

            interval.current = window.setInterval(() => {
                setStateFromUTC(startTimestamp, new Date().getTime());
            }, 1000);
        }
    }, [ startTimestamp, interval ]);

    /**
     * Stop conference timer.
     *
     * @returns {void}
     */
    const stopTimer = useCallback(() => {
        if (interval.current) {
            console.log("start timer comes here : conference timer1", participant.length)
            if(participant.length<=1){
                console.log("start timer comes here : conference timer2", participant.length)
                setStartTimestamp(0);
                getParticipantCountRemoteOnly
            }
            setStartTimestamp(0);
            console.log("start timer comes here : conference timer3", participant.length)
            if(participant.length<=1){
            clearInterval(interval.current);
            console.log("start timer comes here : conference timer4", participant.length)
            interval.current = undefined;
            }
        }
        if(participant.length<=1){
            console.log("start timer comes here : conference timer5", participant.length)
        setTimerValue(getLocalizedDurationFormatter(0));
        }
    }, [ interval ]);

    useEffect(() => {
        startTimer();

        return () => stopTimer();
    }, [ startTimestamp ]);


    if (!startTimestamp) {
        return null;
    }

    return (<ConferenceTimerDisplay
        textStyle = { textStyle }
        timerValue = { timerValue } />);
};

export default ConferenceTimer;
