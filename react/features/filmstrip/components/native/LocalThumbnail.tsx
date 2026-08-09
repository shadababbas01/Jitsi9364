import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    PanResponder,
    PanResponderGestureState,
    View,
    ViewStyle,
    useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { IconMicSlash } from '../../../base/icons/svg';
import { pinParticipant } from '../../../base/participants/actions';
import { getLocalParticipant, getParticipantById, getParticipantCount } from '../../../base/participants/functions';
import BaseIndicator from '../../../base/react/components/native/BaseIndicator';
import { isParticipantAudioMuted } from '../../../base/tracks/functions.native';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import { selectParticipantInLargeVideo } from '../../../large-video/actions.any';
import { getLargeVideoParticipant } from '../../../large-video/functions';

import Thumbnail from './Thumbnail';
import styles, { LOCAL_THUMBNAIL_BOTTOM_OFFSET } from './styles';

// Small (collapsed) dimensions — like WhatsApp PiP
const THUMB_SMALL_W = 120;
const THUMB_SMALL_H = 160;
// Full (expanded) dimensions — when toolbar is showing
const THUMB_BIG_W = 160;
const THUMB_BIG_H = 270;

// How far from either edge the thumbnail snaps to
const EDGE_SNAP_MARGIN = BaseTheme.spacing[2];

const localMutedBadgeStyle: ViewStyle = {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: BaseTheme.shape.borderRadius,
    bottom: 14,
    left: 6,
    margin: 2,
    padding: 2,
    position: 'absolute'
};

/**
 * Component to render a local thumbnail that can be separated from the
 * remote thumbnails later.
 *
 * @returns {ReactElement}
 */
export default function LocalThumbnail() {
    const dispatch = useDispatch();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isLandscape = windowWidth > windowHeight;

    const localParticipantId = useSelector((state: IReduxState) => getLocalParticipant(state)?.id);
    const largeVideoParticipantId = useSelector((state: IReduxState) => getLargeVideoParticipant(state)?.id);
    const participantCount = useSelector((state: IReduxState) => getParticipantCount(state));
    const remoteParticipantId = useSelector((state: IReduxState) => state['features/filmstrip'].remoteParticipants[0]);

    const isOneToOne = participantCount === 2 && Boolean(remoteParticipantId);
    const floatingParticipantId
        = isOneToOne && largeVideoParticipantId === localParticipantId
            ? remoteParticipantId
            : localParticipantId;
    const [ isExpanded, setIsExpanded ] = useState(false);

    // Mic muted for the floating participant. Asked of the meeting rather than of the audio track, so that somebody in
    // a live translation call is called muted only when they have really closed their microphone: their conference
    // track stays muted for the whole of that call whatever they do with it.
    const floatingParticipant
        = useSelector((state: IReduxState) => getParticipantById(state, floatingParticipantId ?? ''));
    const isMicMuted = useSelector((state: IReduxState) =>
        (floatingParticipant ? isParticipantAudioMuted(floatingParticipant, state) : true));
    const isLocal = floatingParticipantId === localParticipantId;

    const edgeMargin = BaseTheme.spacing[1];
    const collapsedHeight = isLandscape ? 148 : THUMB_SMALL_H;
    const collapsedWidth = Math.round((THUMB_SMALL_W / THUMB_SMALL_H) * collapsedHeight);
    const maxExpandedHeight = Math.max(
        collapsedHeight,
        windowHeight - insets.top - insets.bottom - (edgeMargin * 2)
    );
    const expandedHeight = Math.min(THUMB_BIG_H, maxExpandedHeight);
    const expandedWidth = Math.round((THUMB_BIG_W / THUMB_BIG_H) * expandedHeight);
    const thumbnailWidth = isExpanded ? expandedWidth : collapsedWidth;
    const thumbnailHeight = isExpanded ? expandedHeight : collapsedHeight;
    const initialBottomOffset = isLandscape
        ? Math.max(insets.bottom + edgeMargin, BaseTheme.spacing[2])
        : Math.max(insets.bottom + edgeMargin, LOCAL_THUMBNAIL_BOTTOM_OFFSET);
    const defaultPosition = {
        x: windowWidth - thumbnailWidth - BaseTheme.spacing[2],
        y: windowHeight - thumbnailHeight - initialBottomOffset
    };

    // Animated dimensions
    const animWidth = useRef(new Animated.Value(collapsedWidth)).current;
    const animHeight = useRef(new Animated.Value(collapsedHeight)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(animWidth, { toValue: thumbnailWidth, useNativeDriver: false, tension: 60, friction: 9 }),
            Animated.spring(animHeight, { toValue: thumbnailHeight, useNativeDriver: false, tension: 60, friction: 9 })
        ]).start();
    }, [ animHeight, animWidth, thumbnailHeight, thumbnailWidth ]);

    useEffect(() => {
        setIsExpanded(false);
    }, [ floatingParticipantId ]);

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const [ position ] = useState(() => new Animated.ValueXY(defaultPosition));
    const accumulatedPosition = useRef(defaultPosition);
    const minX = edgeMargin;
    const maxX = Math.max(edgeMargin, windowWidth - edgeMargin - thumbnailWidth);
    const minY = insets.top + edgeMargin;
    const maxY = Math.max(minY, windowHeight - insets.bottom - edgeMargin - thumbnailHeight);

    const getClampedPosition = useCallback((nextX: number, nextY: number) => ({
        x: clamp(nextX, minX, maxX),
        y: clamp(nextY, minY, maxY)
    }), [ maxX, maxY, minX, minY ]);

    const previousOrientationRef = useRef(isLandscape);

    useEffect(() => {
        const orientationChanged = previousOrientationRef.current !== isLandscape;
        const nextPosition = orientationChanged
            ? getClampedPosition(defaultPosition.x, defaultPosition.y)
            : getClampedPosition(accumulatedPosition.current.x, accumulatedPosition.current.y);

        previousOrientationRef.current = isLandscape;
        accumulatedPosition.current = nextPosition;
        position.setValue(nextPosition);
    }, [ defaultPosition.x, defaultPosition.y, getClampedPosition, isLandscape, position ]);

    /**
     * Snaps the thumbnail to the nearest horizontal edge after a drag,
     * matching the WhatsApp / FaceTime floating PiP behaviour.
     */
    const snapToNearestEdge = useCallback((currentX: number, currentY: number) => {
        const screenCenter = windowWidth / 2;

        // Snap to left or right edge
        const snappedAbsX = currentX + thumbnailWidth / 2 < screenCenter
            ? EDGE_SNAP_MARGIN // left edge
            : windowWidth - thumbnailWidth - EDGE_SNAP_MARGIN; // right edge

        const clampedX = clamp(snappedAbsX, minX, maxX);
        const clampedY = clamp(currentY, minY, maxY);

        accumulatedPosition.current = { x: clampedX, y: clampedY };

        Animated.spring(position, {
            toValue: { x: clampedX, y: clampedY },
            useNativeDriver: false,
            tension: 180,
            friction: 22
        }).start();
    }, [ windowWidth, thumbnailWidth, minX, maxX, minY, maxY, position ]);

    // Scale pulse for tap feedback
    const tapScale = useRef(new Animated.Value(1)).current;

    const animateTapPulse = useCallback(() => {
        Animated.sequence([
            Animated.timing(tapScale, {
                toValue: 0.93,
                duration: 80,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false
            }),
            Animated.spring(tapScale, {
                toValue: 1,
                useNativeDriver: false,
                tension: 200,
                friction: 14
            })
        ]).start();
    }, [ tapScale ]);

    const onPressLocalThumbnail = useCallback(() => {
       
        animateTapPulse();

        if (!isExpanded) {
            setIsExpanded(true);

            return;
        }

        if (floatingParticipantId) {
            dispatch(pinParticipant(floatingParticipantId));
            dispatch(selectParticipantInLargeVideo(floatingParticipantId));
        }

        setIsExpanded(false);
    }, [ animateTapPulse, dispatch, floatingParticipantId, isExpanded ]);

    const isDragging = useRef(false);

    const panResponder = useCallback(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e: any, gesture: PanResponderGestureState) =>
            Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
            isDragging.current = false;
        },
        onPanResponderMove: (_e: any, gesture: PanResponderGestureState) => {
            isDragging.current = true;
            const nextX = clamp(accumulatedPosition.current.x + gesture.dx, minX, maxX);
            const nextY = clamp(accumulatedPosition.current.y + gesture.dy, minY, maxY);

            position.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_e: any, gesture: PanResponderGestureState) => {
            const finalX = clamp(accumulatedPosition.current.x + gesture.dx, minX, maxX);
            const finalY = clamp(accumulatedPosition.current.y + gesture.dy, minY, maxY);

            if (isDragging.current) {
                // Snap to nearest horizontal edge — FaceTime/WhatsApp style
              
                snapToNearestEdge(finalX, finalY);
            }
            isDragging.current = false;
        }
    }), [ position, minX, maxX, minY, maxY, snapToNearestEdge ])();

    return (
        <Animated.View
            { ...panResponder.panHandlers }
            pointerEvents = 'box-none'
            style = { [
                styles.localThumbnail,
                {
                    height: animHeight,
                    left: 0,
                    right: undefined,
                    top: 0,
                    bottom: undefined,
                    width: animWidth,
                    transform: [
                        ...position.getTranslateTransform(),
                        { scale: tapScale }
                    ]
                }
            ] as any[] }>
            <Thumbnail
                disablePinOnPress = { true }
                hideIndicators = { true }
                onPress = { onPressLocalThumbnail }
                participantID = { floatingParticipantId }
                thumbnailStyle = { styles.localThumbnailInner } />
            { isLocal && isMicMuted && (
                <View
                    pointerEvents = 'none'
                    style = { localMutedBadgeStyle }>
                    <BaseIndicator icon = { IconMicSlash } />
                </View>
            ) }
        </Animated.View>
    );
}
