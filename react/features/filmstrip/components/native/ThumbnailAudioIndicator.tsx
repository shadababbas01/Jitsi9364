import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, View, ViewStyle } from 'react-native';

import JitsiMeetJS from '../../../base/lib-jitsi-meet/_';
import { ITrack } from '../../../base/tracks/types';

import styles from './styles';

const JitsiTrackEvents = JitsiMeetJS.events.track;

const BAR_COUNT = 24;
const MIN_H = 2;
const MAX_H = 70;
const ACTIVE_AUDIO_LEVEL = 0.02;
const ANIMATE_TICK_MS = 24;
const BAR_GAP = 5;

const BASE_TICK_SPEED = 0.05;
const VOLUME_SPEED_MULTIPLIER = 0.8;

const BAR_FREQS = Array.from({ length: BAR_COUNT }, () => ({
    f1: 1.4 + Math.random() * 1.2,
    f2: 2.6 + Math.random() * 1.8,
    f3: 4.0 + Math.random() * 1.4,
    p1: Math.random() * Math.PI * 2,
    p2: Math.random() * Math.PI * 2,
    p3: Math.random() * Math.PI * 2,
    a1: 20 + Math.random() * 18,
    a2: 10 + Math.random() * 14,
    a3: 5 + Math.random() * 9,
}));

const BASE_HEIGHTS = [
    14, 22, 34, 26, 44, 58, 50, 36,
    54, 68, 60, 46, 62, 52, 32, 56,
    42, 48, 64, 38, 26, 52, 34, 56,
];

function easeHeight(h: number): number {
    return Math.pow(h / MAX_H, 0.60) * MAX_H;
}

// ---------- shared ticker ----------

let tickValue = 0;
let tickerId: ReturnType<typeof setInterval> | undefined;
let tickerRefCount = 0;

const tickListeners = new Set<(t: number) => void>();

function _startTicker() {
    if (tickerId) {
        return;
    }

    tickerId = setInterval(() => {
        tickValue += BASE_TICK_SPEED;
        tickListeners.forEach(listener => listener(tickValue));
    }, ANIMATE_TICK_MS);
}

function _stopTicker() {
    if (tickerId) {
        clearInterval(tickerId);
        tickerId = undefined;
    }
}

function _subscribeTick(listener: (t: number) => void) {
    tickListeners.add(listener);
    tickerRefCount += 1;

    if (tickerRefCount === 1) {
        _startTicker();
    }

    listener(tickValue);

    return () => {
        tickListeners.delete(listener);
        tickerRefCount = Math.max(0, tickerRefCount - 1);

        if (tickerRefCount === 0) {
            _stopTicker();
        }
    };
}

// ---------- component ----------

interface IProps {
    _audioTrack?: ITrack;
    containerStyle?: ViewStyle;
}

export default function ThumbnailAudioIndicator({ _audioTrack, containerStyle }: IProps) {
    const [ audioLevel, setAudioLevel ] = useState(0);

    const barAnims = useMemo(
        () =>
            Array.from({ length: BAR_COUNT }, () => ({
                topH: new Animated.Value(MIN_H),
                botH: new Animated.Value(MIN_H),
            })),
        []
    );

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

    const isMuted = _audioTrack?.muted ?? true;
    const hasActiveAudio = !isMuted && audioLevel >= ACTIVE_AUDIO_LEVEL;

    const audioLevelRef = useRef(audioLevel);
    const hasActiveAudioRef = useRef(hasActiveAudio);

    useEffect(() => {
        audioLevelRef.current = audioLevel;
        hasActiveAudioRef.current = hasActiveAudio;
    }, [ audioLevel, hasActiveAudio ]);

    useEffect(() => {
        if (isMuted) {
            barAnims.forEach(({ topH, botH }) => {
                topH.setValue(MIN_H);
                botH.setValue(MIN_H);
            });

            return;
        }

        return _subscribeTick(t => {
            const amplitude = Math.min(audioLevelRef.current * 2.5, 1);
            const volumeSpeedBoost = 1 + amplitude * VOLUME_SPEED_MULTIPLIER;
            const animatedTime = t * volumeSpeedBoost;
            const active = hasActiveAudioRef.current;

            barAnims.forEach(({ topH, botH }, i) => {
                const f = BAR_FREQS[i];
                let h: number;

                if (active) {
                    const wave =
                        f.a1 * Math.sin(f.f1 * animatedTime + f.p1 + i * 0.38)
                        + f.a2 * Math.sin(f.f2 * animatedTime + f.p2 + i * 0.22)
                        + f.a3 * Math.sin(f.f3 * animatedTime + f.p3 + i * 0.15);

                    const voiceBoost = amplitude * MAX_H * 1.05;

                    h = Math.min(
                        MAX_H,
                        Math.max(MIN_H, BASE_HEIGHTS[i] * 0.45 + wave + voiceBoost)
                    );
                } else {
                    const idleWave =
                        f.a1 * 0.32 * Math.sin(f.f1 * 0.6 * animatedTime + f.p1 + i * 0.38)
                        + f.a2 * 0.18 * Math.sin(f.f2 * 0.4 * animatedTime + f.p2 + i * 0.22);

                    h = Math.min(
                        MAX_H * 0.4,
                        Math.max(MIN_H, BASE_HEIGHTS[i] * 0.18 + idleWave)
                    );
                }

                h = Math.round(easeHeight(h));

                topH.setValue(h);
                botH.setValue(h);
            });
        });
    }, [ isMuted, barAnims ]);

    if (isMuted) {
        return null;
    }

    const screenWidth = Dimensions.get('window').width;
    const containerWidth = screenWidth ;
    const horizontalOffset = ( containerWidth) / 400;

    return (
        <View
            style = { [
                styles.voiceIndicatorContainer,
                containerStyle,
                {
                    width: containerWidth,
                    alignSelf: 'center',
                },
            ] as ViewStyle[] }>

            <View
                pointerEvents = 'none'
                style = { {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: 1,
                    backgroundColor: 'rgba(59, 46, 46, 0.14)',
                } as ViewStyle } />

            <View
                style = { [
                    styles.voiceIndicatorRow,
                    {
                        position: 'relative',
                        height: MAX_H * 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                ] as ViewStyle[] }>

                {barAnims.map(({ topH, botH }, index) => (
                    <View
                        key = { index }
                        style = { {
                            width: 3,
                            height: MAX_H * 2,
                            marginHorizontal: BAR_GAP / 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                        } }>

                        <Animated.View
                            style = { [
                                styles.voiceLine,
                                {
                                    position: 'absolute',
                                    bottom: MAX_H,
                                    width: 3,
                                    height: topH,
                                    borderRadius: 2,
                                    backgroundColor: '#ffffff',
                                    opacity: 1,
                                },
                            ] } />

                        <Animated.View
                            style = { [
                                styles.voiceLine,
                                {
                                    position: 'absolute',
                                    top: MAX_H,
                                    width: 3,
                                    height: botH,
                                    borderRadius: 2,
                                    backgroundColor: '#ffffff',
                                    opacity: 0.6,
                                },
                            ] } />
                    </View>
                ))}
            </View>
        </View>
    );
}