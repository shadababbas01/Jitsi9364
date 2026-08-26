import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GestureResponderEvent } from 'react-native';

/**
 * How far the finger is allowed to wander and still count as a tap rather than as the start of a scroll or a drag.
 */
const TAP_SLOP = 12;

/**
 * How long a finger can stay down and still count as a tap. Beyond this it is a press, and a press on the middle of a
 * panel is not asking for anything.
 */
const TAP_DURATION = 400;

interface ISurfaceTap {

    /**
     * Spread onto anything inside the surface which answers a press of its own, so that press is not also read as a tap
     * on the surface behind it.
     *
     * Touch events travel outwards from whatever was actually touched, so a control's mark is set before the surface is
     * ever asked, which is what lets the surface tell the two apart.
     */
    claim: {
        onTouchStart: () => void;
    };

    /**
     * Spread onto the surface itself.
     */
    handlers: {
        onTouchCancel: () => void;
        onTouchEnd: (event: GestureResponderEvent) => void;
        onTouchStart: (event: GestureResponderEvent) => void;
    };
}

/**
 * Reads a tap anywhere on a surface which is not one of its own controls.
 *
 * Built on the plain touch events rather than on a {@code Pressable} wrapped around everything, for the same reason the
 * drag which closes these panels is: a scroll view in the middle of the surface takes the touch responder the moment
 * the finger lands, and a {@code Pressable} outside it is then never told the press happened. Touch events have no such
 * rule - they are delivered to the whole hierarchy under the finger whoever the responder turns out to be - so the
 * transcript can keep scrolling and a tap on it still reaches the surface.
 *
 * @param {Function} onTap - Called once per tap which was not claimed by a control.
 * @returns {ISurfaceTap}
 */
export default function useS2SV2SurfaceTap(onTap: () => void): ISurfaceTap {

    // Where and when the finger went down, and whether a control underneath it has already spoken for the touch.
    const origin = useRef<{ time: number; x: number; y: number; } | null>(null);
    const claimed = useRef(false);

    const tapped = useRef(onTap);

    useEffect(() => {
        tapped.current = onTap;
    }, [ onTap ]);

    const forget = useCallback(() => {
        origin.current = null;
        claimed.current = false;
    }, []);

    const claim = useMemo(() => ({
        onTouchStart: () => {
            claimed.current = true;
        }
    }), []);

    const handlers = useMemo(() => ({
        onTouchStart: (event: GestureResponderEvent) => {
            origin.current = claimed.current
                ? null
                : {
                    time: event.nativeEvent.timestamp,
                    x: event.nativeEvent.pageX,
                    y: event.nativeEvent.pageY
                };
        },

        onTouchEnd: (event: GestureResponderEvent) => {
            const start = origin.current;
            const wasClaimed = claimed.current;

            forget();

            if (!start || wasClaimed) {
                return;
            }

            const { pageX, pageY, timestamp } = event.nativeEvent;

            if (Math.abs(pageX - start.x) <= TAP_SLOP
                    && Math.abs(pageY - start.y) <= TAP_SLOP
                    && timestamp - start.time <= TAP_DURATION) {
                tapped.current();
            }
        },

        onTouchCancel: forget
    }), [ forget ]);

    return {
        claim,
        handlers
    };
}
