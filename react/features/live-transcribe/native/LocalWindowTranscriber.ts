import { DeviceEventEmitter } from 'react-native';

import { IMelpUtterance, getLocalMicRecorderNativeModule, MELP_UTTERANCE_READY_EVENT } from '../../audio-extraction/functions.native';
import {
    MAX_UTTERANCE_MS,
    MIN_UTTERANCE_MS,
    SILENCE_HANGOVER_MS
} from '../constants';
import logger from '../logger';

import transcribeWavFile from './transcribeWav';

/**
 * Records the local microphone in silence-delimited utterances and turns each one into a caption.
 *
 * One utterance is handed to the transcription service as soon as the native recorder decides the speaker paused.
 * Captions still come out in order, but they no longer wait for a fixed window to expire before they can be sent to
 * the room.
 */
export default class LocalWindowTranscriber {
    private _destroyed = false;
    private _running = false;

    /**
     * Which utterance is recorded next.
     */
    private _sequence = 0;

    /**
     * Which utterance is reported next, so that captions come out in the order they were spoken.
     */
    private _nextToEmit = 0;

    /**
     * The transcripts which are ready but still have an unfinished utterance in front of them.
     */
    private _ready = new Map<number, string>();

    /**
     * Serializes requests so a late answer cannot arrive under a later utterance.
     */
    private _chain: Promise<void> = Promise.resolve();

    private _onText: (text: string) => void;

    /**
     * Guards a running session from late results belonging to an older one.
     */
    private _generation = 0;

    /**
     * The active native subscriptions.
     */
    private _subscriptions: Array<{ remove: () => void; }> = [];

    /**
     * Returns the token the transcription service authenticates with, read per utterance rather than held because it
     * can be refreshed while a meeting is running.
     */
    private _getJwt: () => string | undefined;

    /**
     * Initializes a new {@code LocalWindowTranscriber} instance.
     *
     * @param {Function} onText - Called with each transcript, in the order the utterances were spoken.
     * @param {Function} getJwt - Returns the token to authenticate with.
     */
    constructor(onText: (text: string) => void, getJwt: () => string | undefined = () => undefined) {
        this._onText = onText;
        this._getJwt = getJwt;
    }

    /**
     * Starts recording utterances. Does nothing when already running.
     *
     * @returns {boolean} Whether there is a microphone recorder to run at all.
     */
    start(): boolean {
        const recorder = getLocalMicRecorderNativeModule();

        if (!recorder?.startUtteranceSession) {
            return false;
        }

        if (!this._running && !this._destroyed) {
            this._running = true;
            void this._start(recorder);
        }

        return true;
    }

    /**
     * Stops recording. Utterances already handed to the service are dropped rather than waited for: they describe
     * speech from before the captions were switched off.
     *
     * @returns {void}
     */
    stop() {
        this._running = false;
        this._generation++;
        this._sequence = 0;
        this._nextToEmit = 0;
        this._ready.clear();
        this._chain = Promise.resolve();

        this._subscriptions.forEach(subscription => subscription.remove());
        this._subscriptions = [];

        getLocalMicRecorderNativeModule()?.stopUtteranceSession();
    }

    /**
     * Stops recording and releases everything. The instance cannot be started again.
     *
     * @returns {void}
     */
    destroy() {
        this._destroyed = true;
        this.stop();
    }

    /**
     * Opens the native utterance session and starts listening for pauses.
     *
     * @param {ReturnType<typeof getLocalMicRecorderNativeModule>} recorder - The native recorder.
     * @returns {Promise<void>}
     */
    private async _start(recorder: NonNullable<ReturnType<typeof getLocalMicRecorderNativeModule>>): Promise<void> {
        const generation = ++this._generation;

        this._subscriptions = [
            DeviceEventEmitter.addListener(MELP_UTTERANCE_READY_EVENT, (utterance: IMelpUtterance) => {
                if (!this._running || this._destroyed || generation !== this._generation) {
                    return;
                }

                if (!utterance?.path) {
                    return;
                }

                if (typeof utterance.durationMs === 'number' && utterance.durationMs < MIN_UTTERANCE_MS) {
                    logger.info(`Dropped an utterance of ${utterance.durationMs}ms: too short to be speech`);

                    return;
                }

                const sequence = this._sequence++;

                this._chain = this._chain
                    .then(() => this._transcribe(sequence, utterance, generation))
                    .catch(() => { /* Already reported. The chain must survive it. */ });
            })
        ];

        try {
            await recorder.startUtteranceSession(SILENCE_HANGOVER_MS, MAX_UTTERANCE_MS);
        } catch (error) {
            logger.warn('Could not start the utterance session', error);
            this.stop();
        }
    }

    /**
     * Transcribes one recorded utterance.
     *
     * @param {number} sequence - Which utterance it is.
     * @param {IMelpUtterance} utterance - What the recorder captured.
     * @param {number} generation - Which capture session it belongs to.
     * @returns {Promise<void>}
     */
    private async _transcribe(sequence: number, utterance: IMelpUtterance, generation: number): Promise<void> {
        if (!this._running || this._destroyed || generation !== this._generation) {
            return;
        }

        const fileName = utterance.path.split('/').pop() || 'utterance.wav';

        try {
            const text = (await transcribeWavFile(utterance.path, fileName, {
                jwt: this._getJwt()
            }) ?? '').trim();

            if (!text) {
                logger.info(`Dropped a ${utterance.durationMs}ms utterance: the service heard nothing in it`);
                this._settle(sequence, '');

                return;
            }

            if (!this._running || this._destroyed || generation !== this._generation) {
                return;
            }

            this._settle(sequence, text);
        } catch (error) {
            if (!this._running || this._destroyed || generation !== this._generation) {
                return;
            }

            logger.warn('Could not transcribe a caption utterance', error);
            this._settle(sequence, '');
        }
    }

    /**
     * Records what one utterance came to and reports everything which is now unblocked.
     *
     * @param {number} sequence - Which utterance settled.
     * @param {string} text - What it came to, empty when it produced nothing.
     * @returns {void}
     */
    private _settle(sequence: number, text: string) {
        if (this._destroyed || sequence < this._nextToEmit) {
            return;
        }

        this._ready.set(sequence, text);

        while (this._ready.has(this._nextToEmit)) {
            const settled = this._ready.get(this._nextToEmit) ?? '';

            this._ready.delete(this._nextToEmit);
            this._nextToEmit++;

            if (settled) {
                this._onText(settled);
            }
        }
    }
}
