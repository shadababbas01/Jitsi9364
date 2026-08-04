import {
    BUSY_RETRY_DELAY_MS,
    MAX_BUSY_RETRIES,
    MELP_TTS_URL,
    RECONNECT_DELAY_MS,
    SYNTHESIS_TIMEOUT_MS
} from '../constants';
import logger from '../logger';
import { ISynthesizedAudio, ITtsLanguage } from '../types';

/**
 * The close code the service uses when it rejects the token.
 */
const CLOSE_CODE_AUTH_FAILED = 1008;

/**
 * The message the service answers with when its worker queue is full. Documented as transient, so the request is worth
 * resending rather than failing.
 */
const BUSY_MESSAGE = 'server busy';

/**
 * The message fragment the service answers with when it cannot speak the requested language. A client side mistake
 * rather than a transient failure, so the language is remembered and not asked for again.
 */
const UNSUPPORTED_MESSAGE = 'unsupported language';

/**
 * The queue statistics the service reports when pinged.
 */
interface IQueueStats {
    active_workers?: number;
    max_queue_size?: number;
    queue_size?: number;
}

/**
 * The synthesis request waiting for its audio. There is only ever one, see the class comment.
 */
interface IPendingRequest {
    reject: (error: Error) => void;
    resolve: (audio: ISynthesizedAudio) => void;
    timeout: ReturnType<typeof setTimeout>;
}

/**
 * Turns the {@code languages} payload into a flat list.
 *
 * The service keys it by an arbitrary numeric index rather than by language ID, and neither the keys nor their order are
 * stable across restarts, so the values are taken and sorted here.
 *
 * @param {any} input - The {@code languages} field of a server message.
 * @returns {ITtsLanguage[]}
 */
function normalizeLanguages(input: any): ITtsLanguage[] {
    const entries = Array.isArray(input)
        ? input
        : (input && typeof input === 'object' ? Object.values(input) : []);

    return entries
        .map((entry: any) => {
            const id = typeof entry === 'string' ? entry : entry?.id;

            if (!id || typeof id !== 'string') {
                return undefined;
            }

            return {
                id,
                placeholder: (typeof entry === 'object' && entry?.placeholder) || id.replace(/_/g, '-')
            };
        })
        .filter((language): language is ITtsLanguage => Boolean(language))
        .sort((first, second) => first.placeholder.localeCompare(second.placeholder));
}

/**
 * Puts a language code into the form the service expects, e.g. {@code en-US} and {@code en_us} both become
 * {@code en_US}.
 *
 * @param {string} language - A language code.
 * @returns {string}
 */
function normalizeLanguageId(language: string): string {
    const [ base, region ] = language.replace(/-/g, '_').split('_');

    return region ? `${base.toLowerCase()}_${region.toUpperCase()}` : base.toLowerCase();
}

/*
 * PROTOCOL
 * ========
 *
 * Everything travels as JSON text frames. The service announces what it can speak as soon as the socket opens, keyed by
 * an arbitrary index rather than by language ID:
 *
 *     <- { "type": "languages", "languages": { "0": { "id": "en_US", "placeholder": "English" } } }
 *
 * Speech is asked for by language, never by voice. The service picks the engine and the one voice it has for that
 * language itself, and translates the text first if it is not already in the target language:
 *
 *     -> { "type": "synthesize", "text": "...", "language": "en_US" }
 *     <- { "type": "audio", "data": "<base64>", "format": "wav", "sample_rate": 24000 }
 *
 * Failures share one type, which is why they are only unambiguous while a single request is in flight:
 *
 *     <- { "type": "error", "message": "unsupported language: xx_XX" }
 *
 * Queue health can be asked for at any time:
 *
 *     -> { "type": "ping" }
 *     <- { "type": "pong", "stats": { "queue_size": 0, "max_queue_size": 100, "active_workers": 8 } }
 */

/**
 * Speaks caption text with the Melp speech service, whose neural voices sound markedly less synthetic than the ones the
 * device engine ships with.
 *
 * The service is reached over a WebSocket which it also uses to advertise the languages it can speak, on connect and
 * whenever they change. Requests carry no ID and the service serves them from a shared worker pool, so a response cannot
 * be correlated to a request by arrival order. Only one request is therefore ever in flight: callers are serialized
 * behind each other, which makes the next audio or error frame unambiguously the answer to the request waiting for it.
 * That costs nothing here, because captions are spoken one at a time anyway.
 *
 * Every request carries a timeout so that a response the server never sends cannot wedge the caller's queue, and every
 * failure rejects rather than throws, which is the caller's signal to fall back to the device engine.
 *
 * The voice translation feature talks to the same service from its own provider component. The two are kept apart on
 * purpose, so that changing how captions are spoken cannot regress translated speech.
 *
 * The wire protocol is written out in the comment above this class.
 */
export default class MelpTtsClient {
    /**
     * Called whenever the service advertises the languages it can speak.
     */
    private _onLanguagesChange: (languages: ITtsLanguage[]) => void;

    /**
     * Returns the token to authenticate with, read lazily because it can arrive after the client is created.
     */
    private _getJwt: () => string | undefined;

    /**
     * The token which was rejected, if one was. Kept so that a refreshed token is tried again while the rejected one is
     * not retried every few seconds.
     */
    private _rejectedJwt?: string | null;

    /**
     * Serializes callers, so that only one request is ever in flight. See the class comment.
     */
    private _chain: Promise<unknown> = Promise.resolve();

    private _closed = true;

    private _connecting = false;

    private _languages: ITtsLanguage[] = [];

    private _pending?: IPendingRequest;

    private _reconnectTimeout?: ReturnType<typeof setTimeout>;

    private _socket?: WebSocket;

    /**
     * The queue statistics the service last reported, logged when it turns a request away.
     */
    private _stats?: IQueueStats;

    /**
     * The languages the service turned down, so they are not asked for twice.
     */
    private _unsupported = new Set<string>();

    /**
     * Initializes a new {@code MelpTtsClient} instance.
     *
     * @param {Function} getJwt - Returns the token to authenticate with.
     * @param {Function} onLanguagesChange - Notified when the languages the service can speak become known or change.
     */
    constructor(getJwt: () => string | undefined, onLanguagesChange: (languages: ITtsLanguage[]) => void) {
        this._getJwt = getJwt;
        this._onLanguagesChange = onLanguagesChange;
    }

    /**
     * Whether the client is connected and can synthesize right now.
     *
     * @returns {boolean}
     */
    get connected(): boolean {
        return this._socket?.readyState === WebSocket.OPEN;
    }

    /**
     * The languages the service last advertised. Empty until it has, which is also how a caller can tell that the
     * service has not been reached yet.
     *
     * @returns {ITtsLanguage[]}
     */
    get languages(): ITtsLanguage[] {
        return this._languages;
    }

    /**
     * Opens the connection, if it is not open or being opened already. Safe to call repeatedly.
     *
     * @returns {void}
     */
    connect() {
        this._closed = false;

        if (this._socket || this._connecting) {
            return;
        }

        const jwt = this._getJwt();

        if (this._rejectedJwt !== undefined) {
            if (this._rejectedJwt === (jwt ?? null)) {
                // The service already turned this token down. Reconnecting with it would only be turned down again, so
                // wait for a different one instead of hammering the service.
                return;
            }

            // A different token, worth a try.
            this._rejectedJwt = undefined;
        }

        this._connecting = true;

        try {
            const socket = new WebSocket(this._buildUrl(jwt));

            this._socket = socket;

            socket.onopen = () => {
                this._connecting = false;

                if (this._closed) {
                    socket.close();

                    return;
                }

                // Asked for up front so that the first caption which the service turns away can say how loaded it was.
                this._send({ type: 'ping' });
            };

            socket.onmessage = event => this._onMessage(event);

            socket.onerror = () => {
                try {
                    socket.close();
                } catch (error) {
                    // Already closed.
                }
            };

            socket.onclose = event => {
                this._connecting = false;

                if (this._socket === socket) {
                    this._socket = undefined;
                }

                if (event?.code === CLOSE_CODE_AUTH_FAILED) {
                    // The socket is closed right after the service reports the failure, so it cannot be reused and
                    // there is no point reconnecting until the token changes.
                    this._rejectedJwt = jwt ?? null;
                    logger.warn('The speech service rejected the token');
                }

                // Nothing can be delivered any more, so a waiting caller falls back to the device engine instead of
                // waiting out its timeout.
                this._failPending(new Error('The speech service disconnected'));
                this._scheduleReconnect();
            };
        } catch (error) {
            this._connecting = false;
            this._socket = undefined;
            logger.warn('Failed to connect to the speech service', error);
            this._scheduleReconnect();
        }
    }

    /**
     * Closes the connection and fails everything waiting on it.
     *
     * @returns {void}
     */
    close() {
        this._closed = true;

        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
            this._reconnectTimeout = undefined;
        }

        const socket = this._socket;

        this._socket = undefined;
        this._connecting = false;

        try {
            socket?.close();
        } catch (error) {
            // Already closed.
        }

        this._failPending(new Error('The speech service was closed'));
    }

    /**
     * Returns the ID the service knows a language by, if it can speak it at all.
     *
     * The languages the service advertises carry a region, e.g. {@code en_US}, while a caption language often does not,
     * e.g. {@code en}, so a language without a region matches the first advertised one which shares its base.
     *
     * @param {string} language - A language code, e.g. 'hi', 'en-US' or 'zh_CN'.
     * @returns {string | undefined} - Undefined when the service cannot speak it, or has not said what it can speak yet.
     */
    resolveLanguage(language?: string | null): string | undefined {
        if (!language || !this._languages.length) {
            return undefined;
        }

        const wanted = normalizeLanguageId(language);
        const exact = this._languages.find(candidate => normalizeLanguageId(candidate.id) === wanted);

        if (exact) {
            return this._unsupported.has(exact.id) ? undefined : exact.id;
        }

        const base = wanted.split('_')[0];
        const sameBase = this._languages.find(candidate => normalizeLanguageId(candidate.id).split('_')[0] === base);

        return sameBase && !this._unsupported.has(sameBase.id) ? sameBase.id : undefined;
    }

    /**
     * Synthesizes text, waiting for any request already in flight first.
     *
     * @param {string} text - The text to speak.
     * @param {string} language - The ID of the language to speak it in, as returned by {@link resolveLanguage}.
     * @returns {Promise<ISynthesizedAudio>} - Rejects if the service cannot be reached, cannot speak the language or
     * does not answer in time, which is the caller's signal to fall back to the device engine.
     */
    synthesize(text: string, language: string): Promise<ISynthesizedAudio> {
        const run = () => this._synthesize(text, language);

        // Chained onto both outcomes, so that a rejected request does not break the chain for the ones behind it.
        const result = this._chain.then(run, run);

        this._chain = result.catch(() => undefined);

        return result;
    }

    /**
     * Sends one synthesis request and waits for its audio, resending it while the service reports itself too busy to
     * serve it.
     *
     * @param {string} text - The text to speak.
     * @param {string} language - The ID of the language to speak it in.
     * @param {number} attempt - Which attempt this is, counting from zero.
     * @returns {Promise<ISynthesizedAudio>}
     */
    private async _synthesize(text: string, language: string, attempt = 0): Promise<ISynthesizedAudio> {
        if (this._unsupported.has(language)) {
            throw new Error(`The speech service cannot speak ${language}`);
        }

        const socket = this._socket;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            this.connect();

            throw new Error('The speech service is not connected');
        }

        try {
            return await new Promise<ISynthesizedAudio>((resolve, reject) => {
                this._pending = {
                    reject,
                    resolve,
                    timeout: setTimeout(() => {
                        // Whatever the service does with the request now, its answer can no longer be told apart from
                        // the answer to the next one, so the connection is dropped and reopened. Letting a late frame
                        // through would resolve an unrelated caption with the wrong audio.
                        this._pending = undefined;
                        reject(new Error('The speech service did not answer in time'));
                        this._reset();
                    }, SYNTHESIS_TIMEOUT_MS)
                };

                if (!this._send({
                    language,
                    text,
                    type: 'synthesize'
                })) {
                    this._settle(() => reject(new Error('Failed to reach the speech service')));
                }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.toLowerCase().includes(BUSY_MESSAGE) && attempt < MAX_BUSY_RETRIES) {
                logger.warn(`The speech service is busy, retrying (queue ${this._stats?.queue_size ?? '?'}/${
                    this._stats?.max_queue_size ?? '?'})`);

                await new Promise<void>(resolve => {
                    setTimeout(() => resolve(), BUSY_RETRY_DELAY_MS * (attempt + 1));
                });

                return this._synthesize(text, language, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Handles a message from the service.
     *
     * @param {WebSocketMessageEvent} event - The received message.
     * @returns {void}
     */
    private _onMessage(event: WebSocketMessageEvent) {
        let payload;

        try {
            payload = JSON.parse(String(event.data));
        } catch (error) {
            logger.warn('Failed to parse a speech service message', error);

            return;
        }

        // Every message carries its type, and nothing may be inferred from arrival order, so this branches on the type
        // alone.
        switch (payload?.type) {
        case 'languages': {
            const languages = normalizeLanguages(payload.languages);

            this._languages = languages;
            this._onLanguagesChange(languages);
            break;
        }

        case 'audio':
            this._settle(pending => payload.data
                ? pending.resolve({
                    data: payload.data,
                    format: payload.format || 'wav',
                    sampleRate: Number(payload.sample_rate) || undefined
                })
                : pending.reject(new Error('The speech service returned no audio')));
            break;

        case 'pong':
            this._stats = payload.stats;
            break;

        case 'error': {
            const message = String(payload.message ?? 'The speech service reported an error');

            if (message.toLowerCase().includes(UNSUPPORTED_MESSAGE)) {
                // A client side mistake rather than a transient failure. Remembering it keeps every later caption in
                // this language from making the same round trip before falling back to the device engine.
                const language = message.split(':').pop()?.trim();

                if (language) {
                    this._unsupported.add(language);
                }

                logger.warn(`The speech service cannot speak the caption language: ${message}`);
            }

            this._settle(pending => pending.reject(new Error(message)));
            break;
        }
        }
    }

    /**
     * Builds the URL to connect to, carrying the token when there is one.
     *
     * A WebSocket upgrade cannot carry headers, so the service takes the token as a query parameter. It is left off
     * entirely when there is none, which is what a deployment with authentication turned off expects.
     *
     * @param {string} jwt - The token to authenticate with, if any.
     * @returns {string}
     */
    private _buildUrl(jwt?: string): string {
        if (!jwt) {
            return MELP_TTS_URL;
        }

        const separator = MELP_TTS_URL.includes('?') ? '&' : '?';

        return `${MELP_TTS_URL}${separator}token=${encodeURIComponent(jwt)}`;
    }

    /**
     * Sends a frame, if the socket is open.
     *
     * @param {Object} frame - What to send.
     * @returns {boolean} - Whether it was sent.
     */
    private _send(frame: Object): boolean {
        const socket = this._socket;

        if (socket?.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            socket.send(JSON.stringify(frame));

            return true;
        } catch (error) {
            logger.warn('Failed to send to the speech service', error);

            return false;
        }
    }

    /**
     * Settles the request in flight, if there is one.
     *
     * @param {Function} settle - Resolves or rejects it.
     * @returns {void}
     */
    private _settle(settle: (pending: IPendingRequest) => void) {
        const pending = this._pending;

        if (!pending) {
            return;
        }

        this._pending = undefined;
        clearTimeout(pending.timeout);
        settle(pending);
    }

    /**
     * Rejects the request waiting for audio, if there is one.
     *
     * @param {Error} error - Why it cannot be served.
     * @returns {void}
     */
    private _failPending(error: Error) {
        this._settle(pending => pending.reject(error));
    }

    /**
     * Drops the connection so that it is reopened, used when a late response would be mistaken for the answer to a
     * later request.
     *
     * @returns {void}
     */
    private _reset() {
        const socket = this._socket;

        this._socket = undefined;

        try {
            socket?.close();
        } catch (error) {
            // Already closed.
        }

        this._scheduleReconnect();
    }

    /**
     * Reopens the connection after a delay.
     *
     * @returns {void}
     */
    private _scheduleReconnect() {
        if (this._closed || this._reconnectTimeout) {
            return;
        }

        this._reconnectTimeout = setTimeout(() => {
            this._reconnectTimeout = undefined;

            if (!this._closed) {
                this.connect();
            }
        }, RECONNECT_DELAY_MS);
    }
}
