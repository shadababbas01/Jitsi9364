import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Dimensions } from 'react-native';

import { IReduxState } from '../../../app/types';
import { pinParticipant } from '../../../base/participants/actions';
import {
    getLocalParticipant,
    getParticipantCountRemoteOnly,
    getRemoteParticipantsSorted
} from '../../../base/participants/functions';
import { getHideSelfView } from '../../../base/settings/functions.any';
import { shouldDisplayTileView } from '../../../video-layout/functions.native';
import { FILMSTRIP_SIZE } from '../../constants';

import Thumbnail from './Thumbnail';

const FLOATING_WIDTH = 140;
const FLOATING_HEIGHT = 190;
const FLOATING_MARGIN = 12;
const FLOATING_END_MARGIN = 0;
const FLOATING_RADIUS = 0;
const TAP_SLOP = 4;
const { width, height } = Dimensions.get('window');
const CAMERA_BUTTON_SIZE = 32;
const CAMERA_BUTTON_PADDING = 4;
const CAMERA_BUTTON_MARGIN = 8;
const FLOATING_THUMBNAIL_Z_INDEX = 1000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export default function FloatingLocalThumbnail() {
    const localParticipant = useSelector(getLocalParticipant);
    const largeVideoParticipantId = useSelector(
        (state: IReduxState) => state['features/large-video']?.participantId);
    const remoteParticipantCount = useSelector(getParticipantCountRemoteOnly);
    const remoteParticipants = useSelector(getRemoteParticipantsSorted);
    const disableSelfView = useSelector(getHideSelfView);
    const isTileView = useSelector(shouldDisplayTileView);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const minX = insets.left + FLOATING_MARGIN;
    const minY = insets.top + FLOATING_MARGIN;
    const maxX = Math.max(minX, screenWidth - FLOATING_WIDTH - FLOATING_END_MARGIN - insets.right);
    const maxY = Math.max(minY, screenHeight - FLOATING_HEIGHT - FLOATING_MARGIN - insets.bottom);
    const defaultY = clamp(
        maxY - (FILMSTRIP_SIZE + FLOATING_MARGIN + 150),
        minY,
        maxY
    );
    const defaultPosition = {
        x: maxX,
        y: defaultY
    };

    const position = useRef(new Animated.ValueXY(defaultPosition)).current;
    const lastPosition = useRef(defaultPosition);
    const previousWindowSize = useRef({
        height: screenHeight,
        width: screenWidth
    });
    const panEnabled = useRef(true);
    const lastNonLocalLargeVideoId = useRef<string | undefined>();

    useEffect(() => {
        if (!localParticipant) {
            return;
        }

        if (largeVideoParticipantId && largeVideoParticipantId !== localParticipant.id) {
            lastNonLocalLargeVideoId.current = largeVideoParticipantId;
        }
    }, [ largeVideoParticipantId, localParticipant ]);

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
        const wasLandscape
            = previousWindowSize.current.width > previousWindowSize.current.height;
        const dimensionsChanged
            = previousWindowSize.current.width !== screenWidth
                || previousWindowSize.current.height !== screenHeight;
        const isPortrait = screenHeight >= screenWidth;

        previousWindowSize.current = {
            height: screenHeight,
            width: screenWidth
        };

        if (!dimensionsChanged) {
            return;
        }

        const nextPosition = wasLandscape && isPortrait
            ? { x: maxX + 65, y: maxY -250 }
            : defaultPosition;

        lastPosition.current = nextPosition;
        position.setValue(nextPosition);
    }, [ defaultPosition, maxX, maxY, position, screenHeight, screenWidth ]);

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
                const isLocalOnStage = largeVideoParticipantId === localParticipant.id;

                if (isLocalOnStage) {
                    const targetId = lastNonLocalLargeVideoId.current || remoteParticipants?.[0];

                    dispatch(pinParticipant(targetId ?? null));
                } else {
                    if (largeVideoParticipantId) {
                        lastNonLocalLargeVideoId.current = largeVideoParticipantId;
                    }

                    dispatch(pinParticipant(localParticipant.id));
                }
            }
        }
    }), [
        minX,
        minY,
        maxX,
        maxY,
        position,
        localParticipant,
        largeVideoParticipantId,
        remoteParticipants,
        dispatch
    ]);

    if (!localParticipant || disableSelfView || isTileView || remoteParticipantCount < 1) {
        return null;
    }

    const isLocalOnStage = largeVideoParticipantId === localParticipant.id;
    const floatingParticipantId = isLocalOnStage
        ? (lastNonLocalLargeVideoId.current || remoteParticipants?.[0] || localParticipant.id)
        : localParticipant.id;

    return (
        <Animated.View
            needsOffscreenAlphaCompositing = { true }
            pointerEvents = 'box-only'
            renderToHardwareTextureAndroid = { true }
            style = { {
                position: 'absolute',
                zIndex: 0,
                width: width * 0.28,
                height: height * 0.18,
                borderRadius: FLOATING_RADIUS,
                overflow: 'hidden',
                left: position.x,
                top: position.y
            } as ViewStyle}
            { ...panResponder.panHandlers }>
            <Thumbnail
                backgroundColor = 'black'
                borderRadius = { 8 }
                borderWidth = { 2 }
                disableDominantSpeakerIndicator = { true }
                height = { height * 0.17 }
                hideAudioIndicatorWhenVideoOn = { true }
                participantID = { floatingParticipantId }
                renderDisplayName = { false }
                showAudioIndicator = { true }
                tileView = { true }
                width = { width * 0.27 } />
        </Animated.View>
    );
}
