import React, { useEffect, useMemo, useState } from 'react';
import { View, ViewStyle } from 'react-native';

import JitsiMeetJS from '../../../base/lib-jitsi-meet/_';
import { ITrack } from '../../../base/tracks/types';

import styles from './styles';

const JitsiTrackEvents = JitsiMeetJS.events.track;

const BAR_COUNT = 9;
const CENTER_INDEX = Math.floor(BAR_COUNT / 2);
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 18;
const ACTIVE_AUDIO_LEVEL = 0.02;

interface IProps {
    _audioTrack?: ITrack;
}

export default function ThumbnailAudioIndicator({ _audioTrack }: IProps) {
    const [ audioLevel, setAudioLevel ] = useState(0);

    useEffect(() => {
        setAudioLevel(0);

        const jitsiTrack = _audioTrack?.jitsiTrack;

        if (jitsiTrack) {
            jitsiTrack.on(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, setAudioLevel);
        }

        return () => {
            if (jitsiTrack) {
                jitsiTrack.off(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, setAudioLevel);
            }
        };
    }, [ _audioTrack ]);

    const bars = useMemo(() => new Array(BAR_COUNT).fill(0), []);

    if (audioLevel < ACTIVE_AUDIO_LEVEL) {
        return null;
    }

    const amplitude = Math.min(audioLevel * 1.6, 1);

    return (
        <View style = { styles.voiceIndicatorContainer as ViewStyle }>
            <View style = { styles.voiceIndicatorRow as ViewStyle }>
                {bars.map((_, index) => {
                    const distance = Math.abs(index - CENTER_INDEX);
                    const falloff = Math.max(0, 1 - distance * 0.18);
                    const level = amplitude * falloff;
                    const height = MIN_HEIGHT + level * (MAX_HEIGHT - MIN_HEIGHT);
                    const opacity = 0.35 + level * 0.65;

                    return (
                        <View
                            key = { index }
                            style = { [
                                styles.voiceLine,
                                { height, opacity }
                            ] } />
                    );
                })}
            </View>
        </View>
    );
}
