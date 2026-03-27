import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { getLocalParticipant } from '../../../base/participants/functions';
import { getHideSelfView } from '../../../base/settings/functions.any';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { shouldDisplayTileView } from '../../../video-layout/functions.native';
import { FILMSTRIP_SIZE } from '../../constants';

import Thumbnail from './Thumbnail';

const TOOLBOX_HEIGHT = 50 + (BaseTheme.spacing[2] * 2);
const TOOLBOX_MARGIN = BaseTheme.spacing[3];

const FLOATING_WIDTH = 140;
const FLOATING_HEIGHT = 190;
const FLOATING_MARGIN = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export default function FloatingLocalThumbnail() {
    const localParticipant = useSelector(getLocalParticipant);
    const disableSelfView = useSelector(getHideSelfView);
    const isTileView = useSelector(shouldDisplayTileView);
    const toolboxVisible = useSelector(isToolboxVisible);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const minX = insets.left + FLOATING_MARGIN;
    const minY = insets.top + FLOATING_MARGIN;
    const maxX = Math.max(minX, screenWidth - FLOATING_WIDTH - FLOATING_MARGIN - insets.right);
    const maxY = Math.max(minY, screenHeight - FLOATING_HEIGHT - FLOATING_MARGIN - insets.bottom);
    const toolboxOffset = toolboxVisible ? (TOOLBOX_HEIGHT + TOOLBOX_MARGIN) : 0;
    const defaultY = clamp(
    maxY - (
        FILMSTRIP_SIZE +
        FLOATING_MARGIN +
        (toolboxVisible ? toolboxOffset * 2 : toolboxOffset)
    ),
    minY,
    maxY
);

    const position = useRef(new Animated.ValueXY({ x: maxX, y: defaultY })).current;
    const lastPosition = useRef({ x: maxX, y: defaultY });

    useEffect(() => {
        const nextX = clamp(lastPosition.current.x, minX, maxX);
        const nextY = clamp(lastPosition.current.y, minY, maxY);

        lastPosition.current = { x: nextX, y: nextY };
        position.setValue(lastPosition.current);
    }, [ minX, minY, maxX, maxY, position ]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
            Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
            position.setOffset(lastPosition.current);
            position.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
            [ null, { dx: position.x, dy: position.y } ],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (_evt, gesture) => {
            position.flattenOffset();
            const nextX = clamp(lastPosition.current.x + gesture.dx, minX, maxX);
            const nextY = clamp(lastPosition.current.y + gesture.dy, minY, maxY);

            lastPosition.current = { x: nextX, y: nextY };
            position.setValue(lastPosition.current);
        }
    }), [ minX, minY, maxX, maxY, position ]);

    if (!localParticipant || disableSelfView || isTileView) {
        return null;
    }

    return (
        <Animated.View
            pointerEvents = 'box-only'
            style = { {
                position: 'absolute',
                zIndex: 10,
                width: FLOATING_WIDTH,
                height: FLOATING_HEIGHT,
                borderRadius: 12,
                overflow: 'hidden',
                left: position.x,
                top: position.y
            } as ViewStyle }
            { ...panResponder.panHandlers }>
            <Thumbnail
                height = { FLOATING_HEIGHT }
                participantID = { localParticipant.id }
                renderDisplayName = { false }
                tileView = { true }
                width = { FLOATING_WIDTH } />
        </Animated.View>
    );
}
