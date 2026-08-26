import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    GestureResponderEvent,
    LayoutChangeEvent
} from 'react-native';

/**
 * How far down the grabber has to be dragged before letting go closes the surface. Short enough that the gesture does
 * not feel like work, long enough that a thumb sliding off a button does not close anything.
 */
const DISMISS_DISTANCE = 56;

/**
 * A flick counts even when it covers less ground than the distance above: the speed, in points per millisecond, says
 * the user meant it.
 */
const DISMISS_VELOCITY = 0.5;

/**
 * How far the surface is allowed to follow the finger before it stops moving. Without a ceiling a long drag would pull
 * the surface off the bottom of the screen and leave a hole where it was.
 */
const MAX_TRAVEL = 240;

/**
 * How long the slide out takes when the surface has its whole height to cover, and the curve it takes: slow to leave
 * and quickest at the end, so the surface reads as being thrown out of the way rather than fading off a list. These are
 * Material's "emphasized accelerate", which is what the sheets in Google's own apps close on.
 */
const EXIT_DURATION = 200;
const EXIT_EASING = Easing.bezier(0.3, 0, 0.8, 0.15);

/**
 * The shortest the slide out is allowed to get. A surface let go of an inch from the bottom still needs long enough to
 * be seen leaving.
 */
const MIN_EXIT_DURATION = 120;

/**
 * How far the surface springs back when a drag falls short of closing it.
 */
const SETTLE_DURATION = 220;

interface IOptions {

    /**
     * Whether to slide the surface out before calling back, which is for surfaces nothing else animates. Left off where
     * the thing containing the surface does the animating itself - a sheet inside a {@code SlidingView}, a list inside a
     * sliding {@code Modal} - because two slides at once is not twice as good.
     *
     * With this off the drag offset is deliberately left where the finger put it rather than being put back, so the
     * container picks the surface up from where it already is and carries on down with it.
     */
    animateExit?: boolean;

    /**
     * Whether the surface is on screen, for surfaces which are hidden by rendering nothing rather than by unmounting.
     * Those keep this hook's state across a close, so without knowing when they come back they would open again still
     * carrying the offset which closed them, which is to say off the bottom of the screen.
     */
    visible?: boolean;
}

interface ISwipeDismiss {

    /**
     * Closes the surface, sliding it out first where {@code animateExit} asked for that. Worth putting on the close
     * button too, so the button and the drag leave the same way.
     */
    dismiss: () => void;

    /**
     * Spread onto the grabber so the drag is picked up there, and only there: the rest of the surface stays free for
     * its own scrolling and its own buttons.
     */
    handlers: {
        onTouchCancel: () => void;
        onTouchEnd: (event: GestureResponderEvent) => void;
        onTouchMove: (event: GestureResponderEvent) => void;
        onTouchStart: (event: GestureResponderEvent) => void;
    };

    /**
     * Put on the surface, so the slide out knows how far down it has to go to be gone. Without it the surface is
     * assumed to be as tall as the window, which still clears the screen but takes a detour to do it.
     */
    onLayout: (event: LayoutChangeEvent) => void;

    /**
     * Put on the surface as a `translateY` so it follows the finger down, springs back when the drag falls short, and
     * slides out when it does not.
     */
    translateY: Animated.Value;
}

/**
 * Lets a surface be pulled down by its grabber and closed by letting go, and closes it on a slide rather than by
 * turning it off.
 *
 * The close button is still there and still the obvious way out; the drag is for the hand which has already learned
 * that anything with a pill at the top goes away when pushed down, and which would otherwise have to reach across the
 * header to find the X.
 *
 * The drag is built on the plain touch events rather than on a {@code PanResponder}, because every one of these
 * grabbers sits inside something which has already taken the responder by the time the finger moves - a scroll view in
 * one case, a pressable in another. Responder negotiation skips over whatever currently holds it and searches upwards
 * from there, so a responder on a grabber nested inside the holder is never even asked. Touch events have no such rule:
 * they are delivered to the whole hierarchy under the finger whoever the responder happens to be.
 *
 * @param {Function} onDismiss - Called once the surface is closed, and once it has finished sliding out where it does.
 * @param {IOptions} options - Which of the two ways the surface leaves, and whether it is one which stays mounted.
 * @returns {ISwipeDismiss}
 */
export default function useS2SV2SwipeDismiss(
        onDismiss: () => void,
        { animateExit = false, visible }: IOptions = {}): ISwipeDismiss {
    const translateY = useRef(new Animated.Value(0)).current;

    // How far down the surface has to travel to be off the screen, learned from its layout.
    const height = useRef(Dimensions.get('window').height);

    // Where and when the finger went down. Null between gestures, which is also what tells a stray move event that it
    // does not belong to a drag.
    const origin = useRef<{ time: number; y: number; } | null>(null);

    // How far down the surface is right now, tracked alongside the animated value because the exit needs to know where
    // it is starting from and an Animated.Value cannot be read synchronously.
    const offset = useRef(0);

    // Read at the end of a drag rather than captured when the handlers were built, so a re-render with a new callback
    // does not leave a half-finished gesture calling the old one.
    const dismissed = useRef(onDismiss);

    useEffect(() => {
        dismissed.current = onDismiss;
    }, [ onDismiss ]);

    // A surface which hides by rendering nothing keeps whatever offset closed it, so it is put back at the top on the
    // way in rather than on the way out, where putting it back would undo the slide.
    useEffect(() => {
        if (visible !== false) {
            offset.current = 0;
            translateY.setValue(0);
        }
    }, [ translateY, visible ]);

    const move = useCallback((to: number) => {
        offset.current = to;
        translateY.setValue(to);
    }, [ translateY ]);

    const settle = useCallback(() => {
        offset.current = 0;
        Animated.timing(translateY, {
            duration: SETTLE_DURATION,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true
        }).start();
    }, [ translateY ]);

    const dismiss = useCallback(() => {
        if (!animateExit) {
            // Left where it is rather than put back: whatever is holding this surface is about to slide it out, and it
            // should pick it up from where the finger left it instead of snatching it back up first.
            dismissed.current();

            return;
        }

        const travel = Math.max(1, height.current - offset.current);

        Animated.timing(translateY, {
            duration: Math.max(
                MIN_EXIT_DURATION,
                Math.round(EXIT_DURATION * (travel / height.current))),
            easing: EXIT_EASING,
            toValue: height.current,
            useNativeDriver: true
        }).start(({ finished }) => {
            if (finished) {
                dismissed.current();

                // Safe the moment the surface is closed, and it saves the next opening from starting off the bottom of
                // the screen for a frame before the effect above catches it.
                move(0);
            }
        });
    }, [ animateExit, move, translateY ]);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        height.current = Math.max(1, event.nativeEvent.layout.height);
    }, []);

    const handlers = useMemo(() => ({
        onTouchStart: (event: GestureResponderEvent) => {
            origin.current = {
                time: event.nativeEvent.timestamp,
                y: event.nativeEvent.pageY
            };
        },

        onTouchMove: (event: GestureResponderEvent) => {
            if (!origin.current) {
                return;
            }

            move(Math.min(MAX_TRAVEL, Math.max(0, event.nativeEvent.pageY - origin.current.y)));
        },

        onTouchEnd: (event: GestureResponderEvent) => {
            const start = origin.current;

            origin.current = null;

            if (!start) {
                return;
            }

            const travelled = event.nativeEvent.pageY - start.y;
            const elapsed = Math.max(1, event.nativeEvent.timestamp - start.time);

            if (travelled > DISMISS_DISTANCE || travelled / elapsed > DISMISS_VELOCITY) {
                dismiss();
            } else {
                settle();
            }
        },

        onTouchCancel: () => {
            origin.current = null;
            settle();
        }
    }), [ dismiss, move, settle ]);

    return {
        dismiss,
        handlers,
        onLayout,
        translateY
    };
}
