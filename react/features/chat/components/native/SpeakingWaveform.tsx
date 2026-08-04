import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';

import { captionsPanelStyles } from './styles';

/**
 * The relative height of each bar at rest, which gives the waveform its shape.
 */
const BAR_SCALES = [ 0.45, 1, 0.7, 1, 0.55 ];

/**
 * An animated waveform which marks the caption the device is reading aloud right now.
 *
 * @returns {JSX.Element}
 */
export default function SpeakingWaveform() {
    const animations = useRef(BAR_SCALES.map(() => new Animated.Value(0.35))).current;

    useEffect(() => {
        const loops = animations.map((value, index) => Animated.loop(Animated.sequence([
            Animated.delay(index * 90),
            Animated.timing(value, {
                duration: 320,
                toValue: 1,
                useNativeDriver: true
            }),
            Animated.timing(value, {
                duration: 320,
                toValue: 0.35,
                useNativeDriver: true
            })
        ])));

        loops.forEach(loop => loop.start());

        return () => loops.forEach(loop => loop.stop());
    }, [ animations ]);

    return (
        <View style = { captionsPanelStyles.waveform as ViewStyle }>
            {
                animations.map((value, index) => (
                    <Animated.View
                        // eslint-disable-next-line react/no-array-index-key
                        key = { index }
                        style = { [
                            captionsPanelStyles.waveformBar,
                            {
                                height: 18 * BAR_SCALES[index],
                                transform: [ { scaleY: value } ]
                            }
                        ] as ViewStyle[] } />
                ))
            }
        </View>
    );
}
