import { IReduxState } from '../../../app/types';
import { INITIAL_LANGUAGES_GRACE_MS, S2S_V2_TTS_URL, SYNTHESIS_TIMEOUT_MS, TTS_RECONNECT_DELAY_MS } from '../../constants';
import logger from '../../logger';

import {
    IDecodedAudio,
    IPiperVoice,
    buildSynthesizeMessage,
    decodeAudioPayload,
    hasAdvertisedVoice,
    normalizeVoiceList,
    resolveVoiceId
} from './PiperProtocol';

/**
 * How often the pending and queued requests are checked for one which has waited past {@link SYNTHESIS_TIMEOUT_MS}.
 */
const TIMEOUT_CHECK_INTERVAL_MS = 5 * 1000;

/**
 * One sentence waiting for a voice, from the moment it is asked for to the moment it is answered or given up on.
 *
 * The language travels rather than a voice id resolved once and stored: a request made before the service's voice
 * list has arrived would otherwise be sent under whatever this device guessed at the time it was queued, even once
 * the real list arrives before it is actually sent.
 */
interface IPendingRequest {
    language: string;
    onFailure: (error: Error) => void;
    onSuccess: (audio: IDecodedAudio) => void;
    queuedAt: number;
    sentAt?: number;
    text: string;
}

/**
 * Speaks to Melp's Piper speech service over a websocket, and turns a sentence and a language into audio.
 *
 * One connection is kept open for as long as a caller needs it, rather than one per sentence: the service answers
 * requests out of a shared pool with no identifier attached to the reply, so only one request may usefully be in
 * flight on a connection at a time and the next frame received is unambiguously the answer to it. A sentence handed
 * to {@link synthesize} before the connection is open, or while it is being re-established, waits rather than fails -
 * it is sent as soon as there is somewhere to send it, and only gives up once it has waited past
 * {@link SYNTHESIS_TIMEOUT_MS} with nothing to show for it.
 */
export default class PiperTtsClient {
    private _closed = true;

    private _getState: () => IReduxState;

    private _initialFlushTimer?: ReturnType<typeof setTimeout>;

    private _languages: IPiperVoice[] = [];

    private _pendingRequests: IPendingRequest[] = [];

    private _queuedRequests: IPendingRequest[] = [];

    private _reconnectTimer?: ReturnType<typeof setTimeout>;

    private _socket: WebSocket | null = null;

    private _timeoutCheckTimer?: ReturnType<typeof setInterval>;

    private _webSocketImpl: { OPEN: number; new (url: string): WebSocket; };

    /**
     * Initializes a new {@code PiperTtsClient} instance.
     *
     * @param {Object} options - What it needs to reach the service and to be tested without one.
     */
    constructor(options: {
        getState: () => IReduxState;
        webSocketImpl?: { OPEN: number; new (url: string): WebSocket; };
    }) {
        this._getState = options.getState;
        this._webSocketImpl = options.webSocketImpl ?? WebSocket;
    }

    /**
     * The voices the service has advertised so far. Empty until the first reply naming them has arrived.
     *
     * @returns {Array<IPiperVoice>}
     */
    get languages(): IPiperVoice[] {
        return this._languages;
    }

    /**
     * Returns whether the service has a voice for a language, without guessing one when it does not.
     *
     * @param {string} language - The language in question.
     * @returns {boolean}
     */
    canSpeak(language: string): boolean {
        return hasAdvertisedVoice(language, this._languages);
    }

    /**
     * Opens the connection, or does nothing if one is already open or being retried.
     *
     * @returns {void}
     */
    connect(): void {
        this._closed = false;
        this._startTimeoutCheck();

        if (this._socket) {
            return;
        }

        // Authentication is optional and decided by the service, not by this device: a deployment which does not
        // require it accepts a connection with no token at all, and one which does tells this device so - with an
        // "error" message and a 1008 close - rather than leaving it to guess in advance. A token is sent whenever
        // there is one to send; its absence is not treated as a reason not to even try.
        const jwt = this._getState()['features/base/jwt'].jwt;
        const url = jwt
            ? `${S2S_V2_TTS_URL}${S2S_V2_TTS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(jwt)}`
            : S2S_V2_TTS_URL;

        let socket: WebSocket;

        try {
            socket = new this._webSocketImpl(url);
        } catch (error) {
            logger.warn('Could not open the Piper connection', error);
            console.warn('[s2s-v2] Piper: could not construct the websocket', error);
            this._scheduleReconnect();

            return;
        }

        this._socket = socket;

        console.log(`[s2s-v2] Piper: connecting${jwt ? ' (with a token)' : ' (no token)'}`);

        socket.onopen = () => {
            console.log('[s2s-v2] Piper: connection opened');
            this._onOpen();
        };
        socket.onmessage = event => this._onMessage(event as unknown as { data: string; });
        socket.onerror = () => {
            logger.warn('The Piper connection reported an error');
            console.warn('[s2s-v2] Piper: the connection reported an error');
        };

        // The close code says why more precisely than anything JS-visible: 1008 is the service closing on this
        // device deliberately - almost always an authentication failure, per its own contract - while other codes
        // point at the network instead. Said twice for the reason the rest of this feature already is: the logger
        // reaches the native log, the console reaches whoever is watching the packager while developing, and on
        // React Native those are not the same place.
        socket.onclose = (event: unknown) => {
            const { code, reason } = (event ?? {}) as { code?: number; reason?: string; };

            logger.warn(`The Piper connection closed (code ${code}${reason ? `, reason: ${reason}` : ''})`);
            console.warn(`[s2s-v2] Piper: connection closed (code ${code}${reason ? `, reason: ${reason}` : ''})`);
            this._onClose();
        };
    }

    /**
     * Closes the connection for good and gives up on everything waiting, so that nothing this device asked for
     * arrives after it has stopped caring about the answer.
     *
     * @returns {void}
     */
    disconnect(): void {
        this._closed = true;

        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = undefined;
        }

        this._stopTimeoutCheck();
        this._detachAndClose();

        const error = new Error('The Piper connection was closed');

        this._queuedRequests.splice(0).forEach(request => request.onFailure(error));
        this._pendingRequests.splice(0).forEach(request => request.onFailure(error));
    }

    /**
     * Asks the service to turn one sentence into audio, in the language it was resolved a voice for.
     *
     * Never rejects for want of a connection: a sentence asked for before one exists, or while one is being
     * re-established, is queued and sent as soon as there is somewhere to send it. It only gives up once it has
     * waited past {@link SYNTHESIS_TIMEOUT_MS}.
     *
     * @param {string} text - What to speak.
     * @param {string} language - Which language a caller wants it in.
     * @returns {Promise<IDecodedAudio>}
     */
    synthesize(text: string, language: string): Promise<IDecodedAudio> {
        return new Promise<IDecodedAudio>((resolve, reject) => {
            this._queuedRequests.push({
                language,
                onFailure: reject,
                onSuccess: resolve,
                queuedAt: Date.now(),
                text
            });

            this._flushQueue();
        });
    }

    /**
     * Handles the connection opening.
     *
     * Holds the first batch of requests rather than sending them the instant there is somewhere to send them: the
     * service pushes its voice list unprompted right after opening, and a request sent before that list arrives
     * would have its language resolved by guessing rather than by what the service actually advertises. Only the
     * first batch waits - once the list has arrived once, a reconnect later in the same session flushes immediately,
     * because there is nothing left to wait for.
     *
     * @returns {void}
     */
    private _onOpen() {
        if (this._languages.length) {
            this._flushQueue();

            return;
        }

        this._initialFlushTimer = setTimeout(() => {
            this._initialFlushTimer = undefined;
            this._flushQueue();
        }, INITIAL_LANGUAGES_GRACE_MS);
    }

    /**
     * Sends the next queued request, if the connection is open to send it on and nothing else is already in flight.
     *
     * One at a time on purpose: the service answers out of a shared worker pool with no request id attached to the
     * reply, so a second request sent before the first has been answered would leave this device with no way to
     * tell which reply belongs to which request. The next one is sent the moment {@link _onMessage} completes the
     * current one, so nothing here waits any longer than the service itself takes to answer.
     *
     * @returns {void}
     */
    private _flushQueue() {
        const socket = this._socket;

        // Still holding the first batch out for the service's voice list, or for the grace period to run out -
        // whichever ends the hold calls this again once it has. A request made during the hold, direct from
        // {@link synthesize}, must wait here rather than jump the queue it just joined.
        if (!socket || socket.readyState !== this._webSocketImpl.OPEN || this._initialFlushTimer) {
            return;
        }

        if (this._pendingRequests.length || !this._queuedRequests.length) {
            return;
        }

        const request = this._queuedRequests.shift() as IPendingRequest;
        const voiceId = resolveVoiceId(request.language, this._languages);
        const message = buildSynthesizeMessage(request.text, voiceId);

        if (!message) {
            request.onFailure(new Error('Blank text is not sent to the speech service'));

            // Nothing was sent, so there is still nothing in flight - the request after this one may as well go
            // now rather than wait for an answer which was never going to come.
            this._flushQueue();

            return;
        }

        try {
            socket.send(JSON.stringify(message));
            request.sentAt = Date.now();
            this._pendingRequests.push(request);

            // Whether the resolved id is genuinely one the service advertised, or nobody's - settled here, in the
            // log, rather than argued about: a fallback id is exactly the shape a real match is, so the two cannot
            // be told apart by looking at the id alone.
            const matched = this._languages.some(voice => voice.id === voiceId);

            // The resolved language id and a length, never the text itself - it is what a listener is hearing
            // translated, and belongs in a log even less than the room's own conversation does.
            console.log(`[s2s-v2] Piper: sent a ${message.text.length}-character request for "${voiceId}" `
                + `(asked for "${request.language}", ${matched ? 'matched against the advertised list' : 'NOT '
                    + `advertised - sent as a last-resort guess; advertised: [${this._languages.map(voice => voice.id).join(', ')}]`})`);
        } catch (error) {
            logger.warn('Could not send a synthesis request', error);
            this._queuedRequests.unshift(request);
        }
    }

    /**
     * Handles one frame from the service.
     *
     * @param {Object} event - The message event, carrying the frame as JSON text.
     * @returns {void}
     */
    private _onMessage(event: { data: string; }) {
        let message: {
            data?: unknown; format?: unknown; languages?: unknown; message?: unknown; sample_rate?: unknown;
            type?: unknown; voices?: unknown; worker?: unknown;
        };

        try {
            message = JSON.parse(event.data);
        } catch (error) {
            logger.warn('Ignored a Piper frame which was not valid JSON');
            console.warn(`[s2s-v2] Piper: ignored a frame which was not valid JSON (${event.data.length} bytes)`);

            return;
        }

        // Everything the service sent, except the audio payload itself - which is thousands of base64 characters and
        // says nothing a length does not already say. This is the one place every frame this device ever receives
        // over the socket passes through, so it is where a mismatch between what the service actually sends and what
        // this client expects it to send would show up first.
        console.log(`[s2s-v2] Piper: frame received, type "${String(message.type)}" `
            + `(keys: ${Object.keys(message).join(', ')}${'data' in message ? `, data: ${typeof message.data} `
                + `${typeof message.data === 'string' ? `(${message.data.length} chars)` : ''}` : ''}`
            + `${'format' in message ? `, format: ${String(message.format)}` : ''}`
            + `${'sample_rate' in message ? `, sample_rate: ${String(message.sample_rate)}` : ''}`
            + `${'worker' in message ? `, worker: ${String(message.worker)}` : ''})`);

        if (message.type === 'languages' || message.type === 'voices') {
            this._languages = normalizeVoiceList(message);
            console.log(`[s2s-v2] Piper: advertised ${this._languages.length} voice(s): `
                + `${this._languages.map(voice => voice.id).join(', ')}`);

            // No reason to hold the first batch out for the rest of its grace period once the very thing it was
            // waiting for has arrived.
            if (this._initialFlushTimer) {
                clearTimeout(this._initialFlushTimer);
                this._initialFlushTimer = undefined;
                this._flushQueue();
            }

            return;
        }

        if (message.type === 'audio') {
            const request = this._pendingRequests.shift();

            if (!request) {
                return;
            }

            const audio = decodeAudioPayload(message);

            if (audio) {
                console.log(`[s2s-v2] Piper: received audio (${audio.bytes.length} base64 chars, `
                    + `format "${audio.format}")`);
                request.onSuccess(audio);
            } else {
                logger.warn('Piper returned no usable audio');
                console.warn('[s2s-v2] Piper: returned no usable audio (missing, empty, or not valid base64)');
                request.onFailure(new Error('The speech service returned no usable audio'));
            }

            // Whatever was in flight has been answered, so the next queued request - if this device did not stop
            // asking for one while waiting - may as well go now.
            this._flushQueue();

            return;
        }

        if (message.type === 'error') {
            const request = this._pendingRequests.shift();
            const reason = typeof message.message === 'string' && message.message
                ? message.message
                : 'The speech service reported an error';

            logger.warn(`Piper reported: ${reason}`);

            // The one piece of this whole path safe to put in front of a developer verbatim: the service's own
            // exception string, which is precisely how a wrong language id, a missing voice model, or a queue-full
            // condition tell themselves apart from each other and from a bug on this side of the connection.
            console.warn(`[s2s-v2] Piper reported: ${reason}`);
            request?.onFailure(new Error(reason));
            this._flushQueue();

            return;
        }

        logger.debug(`Ignored an unrecognised Piper message type: ${String(message.type)}`);
        console.log(`[s2s-v2] Piper: ignored an unrecognised message type: ${String(message.type)}`);
    }

    /**
     * Handles the connection dropping, expectedly or not.
     *
     * @returns {void}
     */
    private _onClose() {
        if (this._initialFlushTimer) {
            clearTimeout(this._initialFlushTimer);
            this._initialFlushTimer = undefined;
        }

        this._socket = null;

        // Whatever was already sent is earlier in the conversation than anything not yet sent, so it goes back to
        // the front of the queue rather than the back of it.
        this._queuedRequests = [ ...this._pendingRequests.splice(0), ...this._queuedRequests ];

        if (!this._closed) {
            this._scheduleReconnect();
        }
    }

    /**
     * Detaches this client's handlers from the current socket and closes it, without touching anything queued.
     *
     * @returns {void}
     */
    private _detachAndClose() {
        if (this._initialFlushTimer) {
            clearTimeout(this._initialFlushTimer);
            this._initialFlushTimer = undefined;
        }

        const socket = this._socket;

        this._socket = null;

        if (!socket) {
            return;
        }

        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        try {
            socket.close();
        } catch (error) {
            logger.warn('Could not close the Piper connection', error);
        }
    }

    /**
     * Opens the connection again after {@link TTS_RECONNECT_DELAY_MS}, unless one is already scheduled or this
     * client has since been told to disconnect.
     *
     * @returns {void}
     */
    private _scheduleReconnect() {
        if (this._reconnectTimer || this._closed) {
            return;
        }

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = undefined;

            if (!this._closed) {
                this.connect();
            }
        }, TTS_RECONNECT_DELAY_MS);
    }

    /**
     * Starts checking, every {@link TIMEOUT_CHECK_INTERVAL_MS}, for a request which has waited past
     * {@link SYNTHESIS_TIMEOUT_MS} - queued or sent makes no difference to a caller which has been waiting either
     * way. Idempotent, so a session which reconnects more than once does not accumulate one timer per attempt.
     *
     * @returns {void}
     */
    private _startTimeoutCheck() {
        if (this._timeoutCheckTimer) {
            return;
        }

        this._timeoutCheckTimer = setInterval(() => this._checkTimeouts(), TIMEOUT_CHECK_INTERVAL_MS);
    }

    /**
     * Stops the timeout check. Nothing is left for it to watch once this client has been told to disconnect.
     *
     * @returns {void}
     */
    private _stopTimeoutCheck() {
        if (this._timeoutCheckTimer) {
            clearInterval(this._timeoutCheckTimer);
            this._timeoutCheckTimer = undefined;
        }
    }

    /**
     * Gives up on the oldest request still waiting, if it has waited past {@link SYNTHESIS_TIMEOUT_MS}. A request
     * already sent takes the connection down with it and opens a new one: a reply which does arrive after this would
     * otherwise be attributed to whatever is sent next.
     *
     * @returns {void}
     */
    private _checkTimeouts() {
        const now = Date.now();

        if (this._pendingRequests.length && now - (this._pendingRequests[0].sentAt ?? now) >= SYNTHESIS_TIMEOUT_MS) {
            const request = this._pendingRequests.shift() as IPendingRequest;

            logger.warn('A Piper request did not answer in time; reconnecting');
            console.warn('[s2s-v2] Piper: a request did not answer within '
                + `${SYNTHESIS_TIMEOUT_MS}ms; reconnecting`);
            request.onFailure(new Error('The speech service did not answer in time'));

            this._detachAndClose();

            if (!this._closed) {
                this.connect();
            }

            return;
        }

        if (this._queuedRequests.length
                && now - this._queuedRequests[0].queuedAt >= SYNTHESIS_TIMEOUT_MS) {
            const request = this._queuedRequests.shift() as IPendingRequest;

            logger.warn('A Piper request could not be sent in time; giving up on it');
            console.warn('[s2s-v2] Piper: a request could not be sent within '
                + `${SYNTHESIS_TIMEOUT_MS}ms (never connected); giving up on it`);
            request.onFailure(new Error('The speech service could not be reached in time'));
        }
    }
}
