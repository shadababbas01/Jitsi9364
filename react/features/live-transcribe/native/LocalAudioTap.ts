import { NativeEventEmitter } from 'react-native';

import { getLocalAudioTapNativeModule } from '../functions.native';
import logger from '../logger';
import { IUtteranceEvent } from '../types';

/**
 * The event the native tap emits for each captured utterance.
 */
const EVENT_UTTERANCE = 'LocalAudioTap#utterance';

/**
 * Wraps the native microphone tap, which delivers the local participant's speech one utterance at a time.
 *
 * The native side decides where an utterance begins and ends, because that decision has to be made on every 10 ms frame
 * and crossing the bridge that often would cost more than the transcription does. What arrives here is already a whole
 * WAV file holding one stretch of speech.
 *
 * Starting is asynchronous, which matters more than it looks: the local participant can mute while the tap is still
 * being started, and a tap which came up after that would be reading a microphone its owner believes is off. So the
 * caller's intent is tracked separately from whether the tap is up, and a tap which is no longer wanted by the time it
 * starts is stopped immediately.
 *
 * Starting can also answer that it did not start, which happens when the host application supplied its own WebRTC audio
 * device module and there is therefore nothing to attach to. Callers have to handle that rather than assume a running
 * tap.
 */
export default class LocalAudioTap {
    private _emitter?: NativeEventEmitter;

    private _onUtterance: (event: IUtteranceEvent) => void;

    private _running = false;

    /**
     * The start which is in flight, so that repeated calls wait on it rather than starting the tap twice.
     */
    private _starting?: Promise<boolean>;

    private _subscription?: { remove: () => void; };

    /**
     * Whether the caller wants the tap up. See the class comment.
     */
    private _wanted = false;

    /**
     * Initializes a new {@code LocalAudioTap} instance.
     *
     * @param {Function} onUtterance - Called with each captured utterance.
     */
    constructor(onUtterance: (event: IUtteranceEvent) => void) {
        this._onUtterance = onUtterance;
    }

    /**
     * Whether the tap is capturing right now.
     *
     * @returns {boolean}
     */
    get running(): boolean {
        return this._running;
    }

    /**
     * Starts capturing the local participant's speech. Safe to call when already running or already starting.
     *
     * @returns {Promise<boolean>} - Whether the tap is capturing, which it is not when this build or this host
     * application cannot tap the microphone, and not when it was stopped again before it came up.
     */
    start(): Promise<boolean> {
        this._wanted = true;

        if (this._running) {
            return Promise.resolve(true);
        }

        if (!this._starting) {
            this._starting = this._start().finally(() => {
                this._starting = undefined;
            });
        }

        return this._starting;
    }

    /**
     * Stops capturing. Whatever the local participant was in the middle of saying is still delivered, so muting right
     * after finishing a sentence does not lose it.
     *
     * @returns {void}
     */
    stop() {
        this._wanted = false;

        if (!this._running) {
            // A start which is still in flight sees _wanted and stops itself when it lands.
            return;
        }

        this._running = false;
        this._stopNative();
    }

    /**
     * Stops capturing and releases the subscription. The tap cannot be used again afterwards.
     *
     * @returns {void}
     */
    destroy() {
        this.stop();
        this._unsubscribe();
    }

    /**
     * Subscribes to the utterances and asks the native side to start.
     *
     * @returns {Promise<boolean>}
     */
    private async _start(): Promise<boolean> {
        const nativeModule = getLocalAudioTapNativeModule();

        if (!nativeModule) {
            return false;
        }

        // Subscribed before starting, so that an utterance captured immediately cannot be missed.
        if (!this._subscription) {
            this._emitter = new NativeEventEmitter(nativeModule as any);

            // Deliberately not gated on the tap still running: stopping flushes the utterance in progress, and that
            // utterance is encoded on a background thread, so it arrives after stop() has returned. It is speech the
            // local participant produced while the tap was running and belongs in the captions.
            this._subscription = this._emitter.addListener(
                EVENT_UTTERANCE,
                (event: IUtteranceEvent) => {
                    if (event?.data) {
                        this._onUtterance(event);
                    }
                });
        }

        let started;

        try {
            started = Boolean(await nativeModule.start());
        } catch (error) {
            logger.warn('Failed to start the microphone tap', error);
            this._unsubscribe();

            return false;
        }

        if (!started) {
            logger.warn('The microphone cannot be tapped, live transcription is unavailable');
            this._unsubscribe();

            return false;
        }

        if (!this._wanted) {
            // Stopped while this was in flight. The tap is up on the native side and has to be taken down again, or it
            // would be reading a microphone whose owner has already muted it.
            this._stopNative();

            return false;
        }

        this._running = true;

        return true;
    }

    /**
     * Asks the native side to stop capturing.
     *
     * @returns {void}
     */
    private _stopNative() {
        try {
            getLocalAudioTapNativeModule()?.stop();
        } catch (error) {
            logger.warn('Failed to stop the microphone tap', error);
        }
    }

    /**
     * Drops the event subscription.
     *
     * @returns {void}
     */
    private _unsubscribe() {
        this._subscription?.remove();
        this._subscription = undefined;
        this._emitter = undefined;
    }
}
