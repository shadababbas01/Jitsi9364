import {
    MAX_CONCURRENT_REQUESTS,
    MAX_PENDING_UTTERANCES,
    MAX_RETRIES,
    MELP_TRANSCRIBE_URL,
    ORDER_STALL_MS,
    RETRY_DELAY_MS,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_MODE,
    TRANSCRIBE_TIMEOUT_MS
} from '../constants';
import logger from '../logger';
import { IUtterance } from '../types';

/**
 * How the client reports what it produced.
 */
interface IHandlers {

    /**
     * Called when the service stops answering, and again with null when it starts answering once more. Called on the
     * change rather than per utterance, so that a service which is down is reported once instead of every few seconds.
     */
    onFailingChange: (error: Error | null) => void;

    /**
     * Called with the text of an utterance. Not called at all when the service heard nothing in it, which is common:
     * the segmenter errs towards sending a doubtful stretch of audio rather than dropping speech.
     */
    onText: (utterance: IUtterance, text: string) => void;
}

/**
 * An utterance waiting for a free slot, with the retries it has left and the position it has to be reported in.
 */
interface IQueued {
    attempt: number;
    sequence: number;
    utterance: IUtterance;
}

/**
 * A transcribed utterance waiting for the ones before it, so that they can be reported in the order they were spoken.
 * Null when the utterance produced no text, which still has to be recorded or everything behind it would wait forever.
 */
type IReady = { text: string; utterance: IUtterance; } | null;

/**
 * Pulls the text out of a response.
 *
 * The service has answered in three different shapes across its versions, and the Melp chat client already parses all
 * three, so the same is done here rather than pinning this to whichever one is deployed today.
 *
 * @param {any} payload - The parsed response body.
 * @returns {string | undefined}
 */
function extractText(payload: any): string | undefined {
    const candidate
        = payload?.transcription
            ?? payload?.data?.transcription
            ?? payload?.results?.[0]?.transcription;

    return typeof candidate === 'string' ? candidate : undefined;
}

/**
 * Returns the error the service reported, if it reported one.
 *
 * @param {any} payload - The parsed response body.
 * @returns {string | undefined}
 */
function extractError(payload: any): string | undefined {
    const status = payload?.status ?? payload?.results?.[0]?.status;
    const message = payload?.message ?? payload?.error ?? payload?.results?.[0]?.error;

    if (status === 'error' || (message && !extractText(payload))) {
        return typeof message === 'string' ? message : 'The transcription service reported an error';
    }

    return undefined;
}

/**
 * Turns the local participant's captured speech into text with the Melp transcription service.
 *
 * The service takes a whole audio file per request and answers with its text, translated into English on the way when
 * asked in {@code translate} mode. It is reached over plain HTTP rather than a socket, so every utterance costs a round
 * trip plus however long recognition takes; measured against the deployed service that lands a caption roughly a second
 * after the speaker stops, which is what makes segmenting on pauses rather than on a timer worth the trouble.
 *
 * Requests are capped at {@link MAX_CONCURRENT_REQUESTS} at once with a short queue behind them, and the queue drops
 * its oldest entry when it overflows. A backlog is never worth serving: each caption in it lands further behind the
 * conversation than the last, so the display slowly stops describing what is being said. Dropping the oldest keeps the
 * captions that remain aligned with the speaker.
 *
 * Nothing here retries indefinitely and nothing here throws at the caller: a failed utterance is reported and
 * forgotten, because the speaker has already moved on to the next sentence.
 *
 * Requests overlap and the service serves them out of a shared pool, so a short utterance sent second regularly comes
 * back before a long one sent first. Reporting them as they land would put the captions out of order, which reads as
 * gibberish. Results are therefore held in {@link _ready} and released in the order the utterances were captured.
 *
 * Every outcome settles its position, not just a successful one: an utterance the service heard nothing in, one that
 * failed for good, and one dropped from the queue all release the utterances behind them. If the head of the line takes
 * longer than {@link ORDER_STALL_MS} to settle anyway, the ones behind it are let through rather than held hostage; a
 * caption out of order beats the transcript freezing.
 */
export default class MelpTranscribeClient {
    private _handlers: IHandlers;

    /**
     * Returns the token to authenticate with, read lazily because the host application can set it, or refresh it, after
     * the client is created.
     */
    private _getJwt: () => string | undefined;

    private _destroyed = false;

    private _inFlight = 0;

    private _queue: IQueued[] = [];

    /**
     * The position the next enqueued utterance takes in the spoken order.
     */
    private _nextSequence = 0;

    /**
     * The position which has to be reported next, so that captions come out in the order they were spoken.
     */
    private _nextToEmit = 0;

    /**
     * The results which are settled but still waiting for the utterances before them, keyed by position.
     */
    private _ready = new Map<number, IReady>();

    /**
     * Fires when the head of the line has held everything else up for too long. See the class comment.
     */
    private _stallTimeout?: ReturnType<typeof setTimeout>;

    /**
     * The requests which have not settled yet, so that they can be abandoned when the client is destroyed.
     */
    private _controllers = new Set<AbortController>();

    /**
     * Whether the last request failed. Kept so that a service which is down is reported once rather than once per
     * utterance, and so that its coming back can be reported too.
     */
    private _failing = false;

    /**
     * Initializes a new {@code MelpTranscribeClient} instance.
     *
     * @param {Function} getJwt - Returns the token to authenticate with, if the deployment wants one.
     * @param {IHandlers} handlers - Notified of the text and of failures.
     */
    constructor(getJwt: () => string | undefined, handlers: IHandlers) {
        this._getJwt = getJwt;
        this._handlers = handlers;
    }

    /**
     * Queues an utterance to be transcribed, dropping the oldest one waiting if the queue is already full.
     *
     * @param {IUtterance} utterance - The captured speech.
     * @returns {void}
     */
    enqueue(utterance: IUtterance) {
        if (this._destroyed) {
            return;
        }

        this._queue.push({
            attempt: 0,
            sequence: this._nextSequence++,
            utterance
        });

        while (this._queue.length > MAX_PENDING_UTTERANCES) {
            const dropped = this._queue.shift();

            if (dropped) {
                logger.warn(`Dropped an utterance of ${dropped.utterance.durationMs}ms, the transcriber is behind`);

                // Still has to settle its position, or the utterances behind it would wait for one which is never sent.
                this._settle(dropped.sequence, null);
            }
        }

        this._drain();
    }

    /**
     * Abandons everything queued and in flight. The client cannot be used again afterwards.
     *
     * @returns {void}
     */
    destroy() {
        this._destroyed = true;
        this._queue = [];
        this._ready.clear();

        if (this._stallTimeout) {
            clearTimeout(this._stallTimeout);
            this._stallTimeout = undefined;
        }

        for (const controller of this._controllers) {
            controller.abort();
        }

        this._controllers.clear();
    }

    /**
     * Starts as many queued utterances as there are free slots.
     *
     * @returns {void}
     */
    private _drain() {
        while (!this._destroyed && this._inFlight < MAX_CONCURRENT_REQUESTS && this._queue.length) {
            const queued = this._queue.shift();

            if (queued) {
                this._run(queued);
            }
        }
    }

    /**
     * Transcribes one utterance and reports the outcome, retrying it once if the failure looks transient.
     *
     * @param {IQueued} queued - The utterance and how many attempts it has had.
     * @returns {Promise<void>}
     */
    private async _run(queued: IQueued) {
        this._inFlight++;

        try {
            const text = await this._transcribe(queued.utterance);

            this._noteRecovered();

            // The service returns an empty string for a stretch of audio it heard no words in, which the segmenter
            // produces regularly. That is a normal outcome rather than a failure, and there is nothing to display, but
            // the position still has to settle so the utterances behind it are released.
            this._settle(
                queued.sequence,
                text?.trim() ? {
                    text: text.trim(),
                    utterance: queued.utterance
                } : null);
        } catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));

            if (!this._destroyed && queued.attempt < MAX_RETRIES) {
                setTimeout(() => {
                    if (!this._destroyed) {
                        // Keeps its original position: a retry is the same utterance, and it was spoken when it was
                        // spoken.
                        this._queue.push({
                            attempt: queued.attempt + 1,
                            sequence: queued.sequence,
                            utterance: queued.utterance
                        });
                        this._drain();
                    }
                }, RETRY_DELAY_MS);
            } else if (!this._destroyed) {
                this._noteFailed(failure);
                this._settle(queued.sequence, null);
            }
        } finally {
            this._inFlight--;
            this._drain();
        }
    }

    /**
     * Sends one utterance to the service and returns what it heard.
     *
     * @param {IUtterance} utterance - The captured speech.
     * @returns {Promise<string | undefined>}
     */
    private async _transcribe(utterance: IUtterance): Promise<string | undefined> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

        this._controllers.add(controller);

        try {
            const body = new FormData();

            // React Native's FormData takes a file as this shape and streams it from the URI, which is why the audio is
            // handed over as a data URI: it never has to be written to disk, and no temporary file can be left behind
            // when the conference ends abruptly.
            body.append('audio', {
                name: `${utterance.id}.wav`,
                type: 'audio/wav',
                uri: `data:audio/wav;base64,${utterance.data}`
            } as any);
            body.append('mode', TRANSCRIBE_MODE);
            body.append('language', TRANSCRIBE_LANGUAGE);
            body.append('message_id', utterance.id);

            const jwt = this._getJwt();
            const response = await fetch(MELP_TRANSCRIBE_URL, {
                body,
                headers: {
                    Accept: 'application/json',
                    ...jwt ? { Authorization: `Bearer ${jwt}` } : {}
                },
                method: 'POST',
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`The transcription service answered ${response.status}`);
            }

            const payload = await response.json();
            const reported = extractError(payload);

            if (reported) {
                throw new Error(reported);
            }

            return extractText(payload);
        } finally {
            clearTimeout(timeout);
            this._controllers.delete(controller);
        }
    }

    /**
     * Records the outcome of one position in the spoken order and reports everything which is now unblocked.
     *
     * @param {number} sequence - Which position settled.
     * @param {IReady} result - Its text, or null when it produced none.
     * @returns {void}
     */
    private _settle(sequence: number, result: IReady) {
        if (this._destroyed || sequence < this._nextToEmit) {
            // Already let through by the stall guard below; reporting it now would be worse than dropping it.
            return;
        }

        this._ready.set(sequence, result);
        this._drainReady();
    }

    /**
     * Reports every result which has no unsettled utterance in front of it, and arms the stall guard when something is
     * still waiting. See the class comment.
     *
     * @returns {void}
     */
    private _drainReady() {
        while (this._ready.has(this._nextToEmit)) {
            const entry = this._ready.get(this._nextToEmit);

            this._ready.delete(this._nextToEmit);
            this._nextToEmit++;

            if (entry) {
                this._handlers.onText(entry.utterance, entry.text);
            }
        }

        if (this._stallTimeout) {
            clearTimeout(this._stallTimeout);
            this._stallTimeout = undefined;
        }

        if (!this._ready.size) {
            return;
        }

        this._stallTimeout = setTimeout(() => {
            this._stallTimeout = undefined;

            if (this._destroyed || !this._ready.size) {
                return;
            }

            const oldest = Math.min(...this._ready.keys());

            logger.warn(`Giving up on utterance ${this._nextToEmit}, releasing ${this._ready.size} behind it`);
            this._nextToEmit = oldest;
            this._drainReady();
        }, ORDER_STALL_MS);
    }

    /**
     * Reports a failure, but only the first of a run of them. See {@link _failing}.
     *
     * @param {Error} error - What went wrong.
     * @returns {void}
     */
    private _noteFailed(error: Error) {
        logger.warn('Failed to transcribe an utterance', error);

        if (!this._failing) {
            this._failing = true;
            this._handlers.onFailingChange(error);
        }
    }

    /**
     * Reports that the service is answering again, if it had stopped.
     *
     * @returns {void}
     */
    private _noteRecovered() {
        if (this._failing) {
            this._failing = false;
            this._handlers.onFailingChange(null);
        }
    }
}
