import { DEFAULT_SPEECH_RATE, MAX_QUEUE_LENGTH } from '../constants';
import { getCaptionsTtsNativeModule } from '../functions.native';
import logger from '../logger';

interface IUtterance {

    /**
     * The ID of the caption this utterance came from, so the UI can point at the line being spoken.
     */
    id?: string;

    /**
     * The BCP-47 tag of the voice to speak with.
     */
    language: string;

    /**
     * The text to speak.
     */
    text: string;
}

/**
 * Speaks captions one after the other through the device text-to-speech engine.
 *
 * The engine can only be fed as fast as it speaks, so utterances are queued here and handed over one at a time. The
 * queue is deliberately short: captions arrive faster than speech can keep up with, and falling behind the live
 * conversation is worse than dropping a line, so the oldest pending utterance is discarded once the queue is full.
 */
export default class CaptionsTtsQueue {
    /**
     * Called whenever speech starts or stops, so the UI can reflect it.
     */
    private _onSpeakingChange: (speaking: boolean, messageId?: string) => void;

    private _enabled = false;

    private _initialized = false;

    private _initializing?: Promise<boolean>;

    private _queue: IUtterance[] = [];

    private _speaking = false;

    /**
     * Bumped on every flush, so an utterance which was in flight when the queue was flushed cannot resume the drained
     * queue afterwards.
     */
    private _generation = 0;

    /**
     * Initializes a new {@code CaptionsTtsQueue} instance.
     *
     * @param {Function} onSpeakingChange - Notified when speech starts and stops.
     */
    constructor(onSpeakingChange: (speaking: boolean, messageId?: string) => void) {
        this._onSpeakingChange = onSpeakingChange;
    }

    /**
     * Turns the queue on or off. Turning it off stops any ongoing speech and drops everything pending.
     *
     * @param {boolean} enabled - Whether captions should be spoken.
     * @returns {void}
     */
    setEnabled(enabled: boolean) {
        if (this._enabled === enabled) {
            return;
        }

        this._enabled = enabled;

        if (enabled) {
            this._initialize();
        } else {
            this.flush();
        }
    }

    /**
     * Queues a caption to be spoken.
     *
     * @param {IUtterance} utterance - The text and the voice language to speak it with.
     * @returns {void}
     */
    enqueue(utterance: IUtterance) {
        if (!this._enabled || !utterance.text.trim()) {
            return;
        }

        this._queue.push(utterance);

        while (this._queue.length > MAX_QUEUE_LENGTH) {
            this._queue.shift();
        }

        this._speakNext();
    }

    /**
     * Stops the current utterance and drops everything pending.
     *
     * @returns {void}
     */
    flush() {
        this._generation++;
        this._queue = [];

        try {
            getCaptionsTtsNativeModule()?.stop();
        } catch (error) {
            logger.warn('Failed to stop the text to speech engine', error);
        }

        this._setSpeaking(false);
    }

    /**
     * Releases the device engine. To be called when the conference is over.
     *
     * @returns {void}
     */
    destroy() {
        this.setEnabled(false);
        this._initialized = false;
        this._initializing = undefined;

        try {
            getCaptionsTtsNativeModule()?.shutdown();
        } catch (error) {
            logger.warn('Failed to shut the text to speech engine down', error);
        }
    }

    /**
     * Checks whether the device has a voice for the given language.
     *
     * @param {string} language - A BCP-47 language tag.
     * @returns {Promise<boolean>}
     */
    async isLanguageAvailable(language: string): Promise<boolean> {
        const module = getCaptionsTtsNativeModule();

        if (!module || !await this._initialize()) {
            return false;
        }

        try {
            return await module.isLanguageAvailable(language);
        } catch (error) {
            logger.warn('Failed to check the text to speech language', error);

            return false;
        }
    }

    /**
     * Creates the device engine, reusing an initialization which is already under way.
     *
     * @returns {Promise<boolean>} - Whether the engine is usable.
     */
    private _initialize(): Promise<boolean> {
        if (this._initialized) {
            return Promise.resolve(true);
        }

        const module = getCaptionsTtsNativeModule();

        if (!module) {
            return Promise.resolve(false);
        }

        if (!this._initializing) {
            this._initializing = module.initialize()
                .then(ready => {
                    this._initialized = ready;

                    if (!ready) {
                        logger.warn('The device text to speech engine is unavailable');
                    }

                    return ready;
                })
                .catch(error => {
                    logger.warn('Failed to initialize the text to speech engine', error);

                    return false;
                })
                .finally(() => {
                    this._initializing = undefined;
                });
        }

        return this._initializing;
    }

    /**
     * Speaks the next queued utterance, if the engine is free.
     *
     * @returns {void}
     */
    private async _speakNext() {
        if (this._speaking || !this._enabled || !this._queue.length) {
            return;
        }

        const module = getCaptionsTtsNativeModule();

        if (!module || !await this._initialize()) {
            this._queue = [];

            return;
        }

        const generation = this._generation;
        const utterance = this._queue.shift();

        if (!utterance || !this._enabled || generation !== this._generation) {
            return;
        }

        this._setSpeaking(true, utterance.id);

        try {
            await module.speak(utterance.text, utterance.language, DEFAULT_SPEECH_RATE);
        } catch (error) {
            logger.warn('Failed to speak a caption', error);
        }

        if (generation !== this._generation) {
            // The queue was flushed while we were speaking.
            return;
        }

        this._setSpeaking(false);
        this._speakNext();
    }

    /**
     * Updates the speaking state and notifies the listener when it changes.
     *
     * @param {boolean} speaking - Whether a caption is being spoken.
     * @param {string} messageId - The caption being spoken, if any.
     * @returns {void}
     */
    private _setSpeaking(speaking: boolean, messageId?: string) {
        if (this._speaking === speaking) {
            return;
        }

        this._speaking = speaking;
        this._onSpeakingChange(speaking, messageId);
    }
}
