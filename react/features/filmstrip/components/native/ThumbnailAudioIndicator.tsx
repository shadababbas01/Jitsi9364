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
const IDLE_TICK_MS = 120;
const IDLE_PHASE_STEP = 0.35;

let idleTickValue = 0;
let idleTickerId: ReturnType<typeof setInterval> | undefined;
let idleTickerRefCount = 0;
const idleTickListeners = new Set<(tick: number) => void>();

function _startIdleTicker() {
    if (idleTickerId) {
        return;
    }

    idleTickerId = setInterval(() => {
        idleTickValue = (idleTickValue + 1) % 1000;
        idleTickListeners.forEach(listener => listener(idleTickValue));
    }, IDLE_TICK_MS);
}

function _stopIdleTicker() {
    if (idleTickerId) {
        clearInterval(idleTickerId);
        idleTickerId = undefined;
    }
}

function _subscribeIdleTick(listener: (tick: number) => void) {
    idleTickListeners.add(listener);
    idleTickerRefCount += 1;

    if (idleTickerRefCount === 1) {
        _startIdleTicker();
    }

    listener(idleTickValue);

    return () => {
        idleTickListeners.delete(listener);
        idleTickerRefCount = Math.max(0, idleTickerRefCount - 1);

        if (idleTickerRefCount === 0) {
            _stopIdleTicker();
        }
    };
}

interface IProps {
    _audioTrack?: ITrack;
    containerStyle?: ViewStyle;
}

export default function ThumbnailAudioIndicator({ _audioTrack, containerStyle }: IProps) {
    const [ audioLevel, setAudioLevel ] = useState(0);
    const [ idleTick, setIdleTick ] = useState(idleTickValue);

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

    useEffect(() => {
        if (isMuted) {
            return;
        }

        return _subscribeIdleTick(setIdleTick);
    }, [ isMuted ]);

    const bars = useMemo(() => new Array(BAR_COUNT).fill(0), []);

    if (isMuted) {
        return null;
    }

    const amplitude = Math.min(audioLevel * 1.6, 1);
    const idlePhase = idleTick * IDLE_PHASE_STEP;

    return (
        <View style = { [ styles.voiceIndicatorContainer, containerStyle ] as ViewStyle[] }>
            <View style = { styles.voiceIndicatorRow as ViewStyle }>
                {bars.map((_, index) => {
                    const distance = Math.abs(index - CENTER_INDEX);
const falloff = Math.max(0, 1 - distance * 0.18);

// Idle motion when no voice
const idleWave =
  0.22 +
  0.18 * Math.sin(idlePhase + index * 0.7) +
  0.08 * Math.sin(idlePhase * 1.7 + index * 1.3);

// Per-bar random movement
const randomJitter =
  hasActiveAudio
    ? 0.15 * (0.5 + Math.sin(time * 0.012 + index * 2.1)) * Math.random()
    : 0.03 * Math.random();

// Occasional taller spikes like real voice peaks
const spikeChance = hasActiveAudio ? 0.12 : 0;
const spikeBoost = Math.random() < spikeChance ? 0.25 + Math.random() * 0.45 : 0;

// Slight center emphasis so middle bars feel more “mic-like”
const centerBoost = 1 + Math.max(0, 1 - distance * 0.25) * 0.35;

// Base level
const baseLevel = hasActiveAudio ? amplitude : idleWave;

// Final level
const level = Math.max(
  0,
  (baseLevel + randomJitter + spikeBoost) * falloff * centerBoost
);

const height = 10 + level * 100;
const opacity = 1;

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
