import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconArrowLeft, IconArrowRight } from '../../../base/icons/svg';
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
const FLOATING_RADIUS = 8;
const TAP_SLOP = 6;
const HIDE_BUTTON_HIT_SIZE = 44;
const ARROW_TAB_WIDTH = 34;
const ARROW_TAB_HEIGHT = 58;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export default function FloatingLocalThumbnail() {
    const localParticipant = useSelector(getLocalParticipant);
    const largeVideoParticipantId = useSelector(
        (state: IReduxState) => state['features/large-video']?.participantId);
    const remoteParticipantCount = useSelector(getParticipantCountRemoteOnly);
    const remoteParticipants = useSelector(getRemoteParticipantsSorted);
    const disableSelfView = useSelector(getHideSelfView);
    const isTileView = useSelector(shouldDisplayTileView);
    const { clientWidth, clientHeight } = useSelector(
        (state: IReduxState) => state['features/base/responsive-ui']);
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const [ isStashed, setIsStashed ] = useState(false);
    const [ stashedEdge, setStashedEdge ] = useState<'right' | 'left'>('right');
    const isStashedRef = useRef(false);
    const stashedEdgeRef = useRef<'right' | 'left'>('right');

    const minX = insets.left + FLOATING_MARGIN;
    const minY = insets.top + FLOATING_MARGIN;
    const maxX = Math.max(minX, clientWidth - FLOATING_WIDTH - FLOATING_END_MARGIN - insets.right);
    const maxY = Math.max(minY, clientHeight - FLOATING_HEIGHT - FLOATING_MARGIN - insets.bottom);
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
    const lastVisiblePos = useRef(defaultPosition);
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

    const isTouchOnHideButton = (evt: any) => {
        const { locationX, locationY } = evt.nativeEvent || {};

        return typeof locationX === 'number'
            && typeof locationY === 'number'
            && locationX >= 0
            && locationX <= HIDE_BUTTON_HIT_SIZE
            && locationY >= 0
            && locationY <= HIDE_BUTTON_HIT_SIZE;
    };

    const hideThumbnail = useCallback((edge: 'right' | 'left' = 'right') => {
        isStashedRef.current = true;
        stashedEdgeRef.current = edge;
        setStashedEdge(edge);
        setIsStashed(true);

        const targetX = edge === 'right' ? clientWidth : -FLOATING_WIDTH;
        const targetY = clamp(lastPosition.current.y, minY, maxY);

        Animated.timing(position, {
            toValue: { x: targetX, y: targetY },
            duration: 250,
            useNativeDriver: false
        }).start(() => {
            lastPosition.current = { x: targetX, y: targetY };
        });
    }, [ clientWidth, position, minY, maxY ]);

    const showThumbnail = useCallback(() => {
        isStashedRef.current = false;
        setIsStashed(false);

        const targetX = stashedEdgeRef.current === 'right' ? maxX : minX;
        const targetY = clamp(lastPosition.current.y, minY, maxY);

        lastPosition.current = { x: targetX, y: targetY };
        lastVisiblePos.current = { x: targetX, y: targetY };

        Animated.spring(position, {
            toValue: { x: targetX, y: targetY },
            friction: 7,
            tension: 40,
            useNativeDriver: false
        }).start();
    }, [ maxX, minX, minY, maxY, position ]);

    useEffect(() => {
        if (isStashedRef.current) {
            const nextX = stashedEdgeRef.current === 'right' ? clientWidth : -FLOATING_WIDTH;
            const nextY = clamp(lastPosition.current.y, minY, maxY);

            lastPosition.current = { x: nextX, y: nextY };
            position.setValue(lastPosition.current);
            return;
        }

        const nextX = clamp(lastPosition.current.x, minX, maxX);
        const nextY = clamp(lastPosition.current.y, minY, maxY);

        lastPosition.current = { x: nextX, y: nextY };
        lastVisiblePos.current = { x: nextX, y: nextY };
        position.setValue(lastPosition.current);
    }, [ minX, minY, maxX, maxY, clientWidth, position ]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: evt => {
            const isHideHit = isTouchOnHideButton(evt);

            panEnabled.current = !isHideHit;

            return true;
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
        onPanResponderRelease: (evt, gesture) => {
            position.flattenOffset();

            // Handle tap
            if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
                if (isTouchOnHideButton(evt)) {
                    const nearestEdge = lastPosition.current.x >= (minX + maxX) / 2 ? 'right' : 'left';

                    hideThumbnail(nearestEdge);
                    return;
                }

                if (localParticipant) {
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
                return;
            }

            // Check if user swiped/dragged towards edge to stash (like Android PiP)
            const rawDx = gesture.dx;
            const rawVx = gesture.vx;
            const releasedX = lastPosition.current.x + rawDx;

            if ((rawDx > 35 || rawVx > 0.4 || releasedX > maxX + 10) && lastPosition.current.x >= (minX + maxX) / 2) {
                hideThumbnail('right');
                return;
            } else if ((rawDx < -35 || rawVx < -0.4 || releasedX < minX - 10) && lastPosition.current.x < (minX + maxX) / 2) {
                hideThumbnail('left');
                return;
            }

            const nextX = clamp(lastPosition.current.x + gesture.dx, minX, maxX);
            const nextY = clamp(lastPosition.current.y + gesture.dy, minY, maxY);

            lastPosition.current = { x: nextX, y: nextY };
            lastVisiblePos.current = { x: nextX, y: nextY };
            position.setValue(lastPosition.current);
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
        hideThumbnail,
        dispatch
    ]);

    if (!localParticipant || disableSelfView || isTileView || remoteParticipantCount < 1) {
        return null;
    }

    const isLocalOnStage = largeVideoParticipantId === localParticipant.id;
    const floatingParticipantId = isLocalOnStage
        ? (lastNonLocalLargeVideoId.current || remoteParticipants?.[0] || localParticipant.id)
        : localParticipant.id;

    const isNearRightEdge = lastPosition.current.x >= (minX + maxX) / 2;
    const tabY = clamp(lastPosition.current.y + (FLOATING_HEIGHT / 2) - (ARROW_TAB_HEIGHT / 2), minY, maxY);

    return (
        <>
            <Animated.View
                needsOffscreenAlphaCompositing = { true }
                pointerEvents = 'box-only'
                renderToHardwareTextureAndroid = { true }
                style = { {
                    position: 'absolute',
                    zIndex: 1000,
                    width: FLOATING_WIDTH,
                    height: FLOATING_HEIGHT,
                    borderRadius: FLOATING_RADIUS,
                    overflow: 'hidden',
                    left: 0,
                    top: 0,
                    transform: position.getTranslateTransform()
                } as ViewStyle}
                { ...panResponder.panHandlers }>
                <Thumbnail
                    backgroundColor = 'black'
                    borderRadius = { 8 }
                    borderWidth = { 2 }
                    disableDominantSpeakerIndicator = { true }
                    height = { FLOATING_HEIGHT }
                    hideAudioIndicatorWhenVideoOn = { true }
                    participantID = { floatingParticipantId }
                    renderDisplayName = { false }
                    showAudioIndicator = { true }
                    tileView = { true }
                    width = { FLOATING_WIDTH } />

                {/* Hide chevron button on the thumbnail */}
                <View
                    pointerEvents = 'none'
                    style = { {
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10
                    } as ViewStyle }>
                    <Icon
                        color = '#ffffff'
                        size = { 16 }
                        src = { isNearRightEdge ? IconArrowRight : IconArrowLeft } />
                </View>
            </Animated.View>

            {/* Arrow tab to let it back just like PiP does */}
            {isStashed && (
                <TouchableOpacity
                    activeOpacity = { 0.85 }
                    hitSlop = { { top: 12, bottom: 12, left: 12, right: 12 } }
                    onPress = { showThumbnail }
                    style = { {
                        position: 'absolute',
                        zIndex: 1001,
                        top: tabY,
                        ...(stashedEdge === 'right' ? {
                            right: 0,
                            borderTopLeftRadius: 18,
                            borderBottomLeftRadius: 18,
                            borderRightWidth: 0
                        } : {
                            left: 0,
                            borderTopRightRadius: 18,
                            borderBottomRightRadius: 18,
                            borderLeftWidth: 0
                        }),
                        width: ARROW_TAB_WIDTH,
                        height: ARROW_TAB_HEIGHT,
                        backgroundColor: 'rgba(28, 28, 30, 0.92)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        elevation: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: stashedEdge === 'right' ? -2 : 2, height: 2 },
                        shadowOpacity: 0.45,
                        shadowRadius: 5
                    } as ViewStyle }>
                    <Icon
                        color = '#ffffff'
                        size = { 20 }
                        src = { stashedEdge === 'right' ? IconArrowLeft : IconArrowRight } />
                </TouchableOpacity>
            )}
        </>
    );
}
