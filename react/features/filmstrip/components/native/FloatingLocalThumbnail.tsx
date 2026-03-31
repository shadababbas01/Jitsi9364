import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { pinParticipant } from '../../../base/participants/actions';
import { getLocalParticipant, getPinnedParticipant } from '../../../base/participants/functions';
import { getHideSelfView } from '../../../base/settings/functions.any';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import ToggleCameraButton from '../../../toolbox/components/native/ToggleCameraButton';
import { shouldDisplayTileView } from '../../../video-layout/functions.native';
import { FILMSTRIP_SIZE } from '../../constants';

import Thumbnail from './Thumbnail';

const TOOLBOX_HEIGHT = 50 + (BaseTheme.spacing[2] * 2);
const TOOLBOX_MARGIN = BaseTheme.spacing[3];

const FLOATING_WIDTH = 140;
const FLOATING_HEIGHT = 190;
const FLOATING_MARGIN = 12;
const FLOATING_RADIUS = 12;
const TAP_SLOP = 4;
const CAMERA_BUTTON_SIZE = 32;
const CAMERA_BUTTON_PADDING = 4;
const CAMERA_BUTTON_MARGIN = 8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export default function FloatingLocalThumbnail() {
    const localParticipant = useSelector(getLocalParticipant);
    const pinnedParticipant = useSelector(getPinnedParticipant);
    const disableSelfView = useSelector(getHideSelfView);
    const isTileView = useSelector(shouldDisplayTileView);
    const toolboxVisible = useSelector(isToolboxVisible);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const minX = insets.left + FLOATING_MARGIN;
    const minY = insets.top + FLOATING_MARGIN;
    const maxX = Math.max(minX, screenWidth - FLOATING_WIDTH - FLOATING_MARGIN - insets.right);
    const maxY = Math.max(minY, screenHeight - FLOATING_HEIGHT - FLOATING_MARGIN - insets.bottom);
    const toolboxOffset = toolboxVisible ? (TOOLBOX_HEIGHT + TOOLBOX_MARGIN) : 0;
    const toolboxHiddenShift = toolboxVisible ? 0 : 50;
    const defaultY = clamp(
    maxY - (
        FILMSTRIP_SIZE +
        FLOATING_MARGIN +
        (toolboxVisible ? toolboxOffset -25  : toolboxOffset - 25)
    ),
    minY,
    maxY
);

    const position = useRef(new Animated.ValueXY({ x: maxX, y: defaultY })).current;
    const lastPosition = useRef({ x: maxX, y: defaultY });
    const panEnabled = useRef(true);

    const isTouchOnCameraButton = (evt: any) => {
        const { locationX, locationY } = evt.nativeEvent || {};
        const hitSize = CAMERA_BUTTON_SIZE + (CAMERA_BUTTON_PADDING * 2);
        const minHitX = FLOATING_WIDTH - CAMERA_BUTTON_MARGIN - hitSize;
        const maxHitY = CAMERA_BUTTON_MARGIN + hitSize;

        return typeof locationX === 'number'
            && typeof locationY === 'number'
            && locationX >= minHitX
            && locationY <= maxHitY;
    };

    useEffect(() => {
        const nextX = clamp(lastPosition.current.x, minX, maxX);
        const nextY = clamp(lastPosition.current.y, minY, maxY);

        lastPosition.current = { x: nextX, y: nextY };
        position.setValue(lastPosition.current);
    }, [ minX, minY, maxX, maxY, position ]);

    useEffect(() => {
        const delta = toolboxVisible ? -100 : 100;
        const nextX = clamp(lastPosition.current.x, minX, maxX);
        const nextY = clamp(lastPosition.current.y + delta, minY, maxY);

        lastPosition.current = { x: nextX, y: nextY };
        position.setValue(lastPosition.current);
    }, [ toolboxVisible, minX, minY, maxX, maxY, position ]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: evt => {
            const allowPan = !isTouchOnCameraButton(evt);

            panEnabled.current = allowPan;

            return allowPan;
        },
        onMoveShouldSetPanResponder: (_evt, gesture) =>
            panEnabled.current && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
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

            if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP && localParticipant) {
                const isPinned = pinnedParticipant?.id === localParticipant.id;

                dispatch(pinParticipant(isPinned ? null : localParticipant.id));
            }
        }
    }), [ minX, minY, maxX, maxY, position, localParticipant, pinnedParticipant, dispatch ]);

    if (!localParticipant || disableSelfView || isTileView) {
        return null;
    }

    return (
        <Animated.View
            needsOffscreenAlphaCompositing = { true }
            pointerEvents = 'box-only'
            renderToHardwareTextureAndroid = { true }
            style = { {
                position: 'absolute',
                zIndex: 10,
                width: FLOATING_WIDTH,
                height: FLOATING_HEIGHT,
                borderRadius: 16,
                overflow: 'hidden',
                left: position.x,
                top: position.y
            } as ViewStyle }
            { ...panResponder.panHandlers }>
            <View
                pointerEvents = 'box-none'
                style = { {
                    position: 'absolute',
                    right: CAMERA_BUTTON_MARGIN,
                    top: CAMERA_BUTTON_MARGIN,
                    zIndex: 2,
                    padding: CAMERA_BUTTON_PADDING,
                    borderRadius: CAMERA_BUTTON_SIZE,
                    backgroundColor: 'rgba(0, 0, 0, 0.25)'
                } }>
                
            </View>
            <Thumbnail
                disableDominantSpeakerIndicator = { true }
                height = { FLOATING_HEIGHT }
                participantID = { localParticipant.id }
                renderDisplayName = { false }
                tileView = { true }
                width = { FLOATING_WIDTH } />
        </Animated.View>
    );
}
