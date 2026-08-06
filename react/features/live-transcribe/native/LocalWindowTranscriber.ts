import { getLocalMicRecorderNativeModule } from '../../audio-extraction/functions.native';
import { CAPTION_WINDOW_MS, CAPTION_WINDOW_RETRY_MS } from '../constants';
import logger from '../logger';

import transcribeWavFile from './transcribeWav';

/**
 * Records the local microphone in fixed windows and turns each one into a caption.
 *
 * One window is recorded at a time and handed to the transcription service while the next one is already being
 * recorded, so the microphone is never idle waiting for the network. The windows are transcribed concurrently but
 * reported in the order they were spoken: the service serves overlapping requests out of a shared pool, so a short
 * window can easily overtake the longer one in front of it, and captions which read back out of order are worse than
 * captions which arrive a moment later.
 */
export default class LocalWindowTranscriber {
    private _destroyed = false;
    private _running = false;

    /**
     * Which window is recorded next. Also names the file, so two windows cannot collide in the cache directory.
     */
    private _sequence = 0;

    /**
     * Which window is reported next, so that captions come out in the order they were spoken.
     */
    private _nextToEmit = 0;

    /**
     * The transcripts which are ready but still have an unfinished window in front of them.
     */
    private _ready = new Map<number, string>();

    private _onText: (text: string) => void;

    /**
     * Initializes a new {@code LocalWindowTranscriber} instance.
     *
     * @param {Function} onText - Called with each transcript, in the order the windows were spoken.
     */
    constructor(onText: (text: string) => void) {
        this._onText = onText;
    }

    /**
     * Starts recording windows. Does nothing when already running.
     *
     * @returns {boolean} Whether there is a microphone recorder to run at all.
     */
    start(): boolean {
        if (!getLocalMicRecorderNativeModule()) {
            return false;
        }

        if (!this._running && !this._destroyed) {
            this._running = true;
            this._recordNext();
        }

        return true;
    }

    /**
     * Stops recording. Windows already handed to the service are dropped rather than waited for: they describe speech
     * from before the captions were switched off.
     *
     * @returns {void}
     */
    stop() {
        this._running = false;
        getLocalMicRecorderNativeModule()?.stop();
        this._ready.clear();
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
     * Records one window and starts the next, then transcribes what it recorded.
     *
     * @returns {Promise<void>}
     */
    private async _recordNext(): Promise<void> {
        if (!this._running || this._destroyed) {
            return;
        }

        const recorder = getLocalMicRecorderNativeModule();
        const sequence = this._sequence++;

        try {
            const audioPath = await recorder?.recordToFile(`live-caption-${sequence}.wav`, CAPTION_WINDOW_MS);

            // Recording the next window comes first, so that the microphone starts again immediately instead of after
            // this one has been transcribed.
            this._recordNext();

            if (!audioPath) {
                this._settle(sequence, '');

                return;
            }

            this._transcribe(sequence, audioPath);
        } catch (error) {
            // Something else is holding the recorder, typically the audio extraction screen. Backing off and trying
            // again is the whole recovery: whoever has it will let go.
            logger.warn('Could not record a caption window', error);
            this._settle(sequence, '');

            if (this._running && !this._destroyed) {
                setTimeout(() => this._recordNext(), CAPTION_WINDOW_RETRY_MS);
            }
        }
    }

    /**
     * Transcribes one recorded window.
     *
     * @param {number} sequence - Which window it is.
     * @param {string} audioPath - Where it was recorded to.
     * @returns {Promise<void>}
     */
    private async _transcribe(sequence: number, audioPath: string): Promise<void> {
        try {
            this._settle(sequence, await transcribeWavFile(audioPath, `live-caption-${sequence}.wav`));
        } catch (error) {
            logger.warn('Could not transcribe a caption window', error);
            this._settle(sequence, '');
        }
    }

    /**
     * Records what one window came to and reports everything which is now unblocked.
     *
     * @param {number} sequence - Which window settled.
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
