import React from 'react';
import { Text } from 'react-native';

import { IDisplayProps } from '../ConferenceTimer';

const TIMER_TEXT_STYLE = {
    alignSelf: 'center' as const,
    flexShrink: 0,
    includeFontPadding: false,
    minWidth: 64,
    paddingHorizontal: 4,
    textAlign: 'center' as const
};

/**
 * Returns native element to be rendered.
 *
 * @param {Object} props - Component props.
 *
 * @returns {ReactElement}
 */
export default function ConferenceTimerDisplay({ timerValue, textStyle }: IDisplayProps) {
    return (
        <Text
            adjustsFontSizeToFit = { true }
            allowFontScaling = { false }
            minimumFontScale = { 0.75 }
            numberOfLines = { 1 }
            style = { [
                textStyle,
                TIMER_TEXT_STYLE
            ] }>
            { timerValue }
        </Text>
    );
}
