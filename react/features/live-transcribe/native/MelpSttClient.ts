import {
    MELP_TRANSCRIBE_WS_URL,
    STT_LOG_TAG as TAG,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_MODE,
    TRANSCRIBE_WS_CONNECT_TIMEOUT_MS,
    TRANSCRIBE_WS_HEARTBEAT_MS,
    TRANSCRIBE_WS_RECONNECT_DELAY_MS
} from '../constants';
import logger from '../logger';

import { TranscriptionUnreachableError } from './TranscriptionError';

/**
 * The close code the service uses when it rejects the token.
 */
const CLOSE_CODE_AUTH_FAILED = 1008;

/**
 * What the service answers one utterance with.
 */
interface ITranscriptionResult {
    detected_language?: string;
    status?: string;
    transcription?: string;
    transcription_time_sec?: number;
}

export interface ITranscriptionConnectionOptions {
    baseUrl?: string;
    jwt?: string;
    language?: string;
}

/**
 * The request waiting for its answer. There is only ever one, see the class comment.
 */
interface IPendingRequest {
    resolve: (result: ITranscriptionResult | null) => void;
    timeout: ReturnType<typeof setTimeout>;
}

/*
 * PROTOCOL
 * ========
 *
 * Everything the connection needs is settled by the handshake, which carries the mode, the language and the token on the
 * query string because a WebSocket opened from JavaScript cannot send headers of its own:
 *
 *     wss://ai.live.melp.us/stt/ws/transcribe?mode=translate&language=en&auth_token=<JWT>
 *     <- 101 Switching Protocols
 *
 * Nothing is announced on connect. One utterance goes up as one text frame holding the Base64 of a whole WAV file,
 * header included, and comes back as one JSON frame:
 *
 *     -> "UklGRtSIAwBXQVZFZm10IBAAAAABAAEA..."
 *     <- { "status": "success",
 *          "transcription": "The sky above the port was the color of television.",
 *          "detected_language": "en",
 *          "transcription_time_sec": 0.58 }
 *
 * An utterance the service could not read comes back with a {@code status} which is not {@code success}. A transcript
 * which is empty is not a failure: it means nothing was heard, which a pause or a closing door is.
 */

/**
 * Turns recorded utterances into text over the transcription service's socket.
 *
 * Frames carry no request identifier and the service answers out of a worker pool, so an answer cannot be matched to a
 * request by anything in it. Only one request is therefore ever in flight: callers are serialized behind each other,
 * which makes the next frame unambiguously the answer to the request waiting for it. That costs nothing, because every
 * caller in this application already transcribes one utterance at a time so that transcripts come out in the order they
 * were spoken.
 *
 * For the same reason a request which times out takes the socket down with it. The answer to it may still be on its way,
 * and a late frame arriving against the next request would put one speaker's words under another's.
 *
 * Every failure rejects rather than throws, and a failure to reach the service at all rejects with
 * {@link TranscriptionUnreachableError}, which is the caller's signal to fall back to the request-per-utterance
 * endpoint.
 */
export default class MelpSttClient {
    /**
     * Serializes callers, so that only one request is ever in flight. See the class comment.
     */
    private _chain: Promise<unknown> = Promise.resolve();

    private _connecting?: Promise<WebSocket>;

    /**
     * Bumped whenever the socket is dropped, so that a connection which was abandoned mid-handshake cannot install
     * itself once it finally opens, and a socket which has been replaced cannot fail its successor's request as it
     * closes.
     */
    private _generation = 0;

    /**
     * When the socket may be opened again. Set after it drops, so that a service which is down costs one refused
     * connection every few seconds rather than one per utterance.
     */
    private _openAgainAt = 0;

    /**
     * How long the next reconnect waits after an unexpected close. Doubles after each failure up to the cap, then
     * resets after a successful open.
     */
    private _reconnectDelayMs = TRANSCRIBE_WS_RECONNECT_DELAY_MS;

    /**
     * Whether the connection is meant to be up. Set for as long as a call is running, so that a socket which drops is
     * replaced there and then rather than at the next thing somebody says.
     */
    private _wanted = false;

    /**
     * The reconnect which is already due, so that several drops in a row queue one attempt rather than one each.
     */
    private _reconnect?: ReturnType<typeof setTimeout>;

    /**
     * How many times a socket has been opened since the client was made, and how many utterances have gone over them.
     * Only ever logged: a connection which is quietly churning shows up as an attempt count climbing without the
     * utterance count following it.
     */
    private _attempts = 0;

    private _utterances = 0;

    /**
     * When the current socket opened, so that its life can be reported when it closes.
     */
    private _openedAt = 0;

    private _pending?: IPendingRequest;

    /**
     * The idle ping, running for as long as a socket is open.
     */
    private _heartbeat?: ReturnType<typeof setInterval>;

    private _socket?: WebSocket;

    /**
     * The token the current socket was opened with, so that a token which has since been refreshed reconnects rather
     * than going on using a connection authorized by the old one.
     */
    private _socketJwt?: string;

    /**
     * The token which was rejected, if one was. Kept so that a refreshed token is tried again while the rejected one is
     * not retried every few seconds.
     */
    private _rejectedJwt?: string;

    /**
     * The websocket endpoint the current socket was opened against.
     */
    private _socketBaseUrl?: string;

    /**
     * The language the current socket was opened against.
     */
    private _socketLanguage?: string;

    /**
     * Whether the connection is open and can transcribe right now.
     *
     * @returns {boolean}
     */
    get connected(): boolean {
        return this._socket?.readyState === WebSocket.OPEN;
    }

    /**
     * Opens the connection and keeps it open until {@link close}.
     *
     * Called when a call starts rather than when the first thing is said, so that the first sentence of a call does not
     * pay for the handshake, and so that a socket which drops during a silence is replaced during the silence instead
     * of being discovered by whoever speaks next.
     *
 * An idle connection is pinged, because being noticed by its close is exactly what a dead socket cannot rely on: a
 * proxy timing it out or a network path disappearing takes it away without a close event, and it then reports itself
 * open for the rest of the call while dropping everything. The ping is a JSON text frame rather than audio, and it is
 * only ever sent when nothing is waiting for an answer - see the ordering rule above, which a stray reply would
 * otherwise break.
     *
     * @param {string} jwt - The token to authenticate with, if there is one.
     * @returns {void}
     */
    open(options: ITranscriptionConnectionOptions = {}) {
        const { baseUrl, jwt, language } = options;
        logger.info(`${TAG} asked to keep a connection up; token ${jwt ? 'present' : 'absent'}`);

        this._wanted = true;
        this._openAgainAt = 0;
        this._reconnectDelayMs = TRANSCRIBE_WS_RECONNECT_DELAY_MS;
        this._rejectedJwt = undefined;

        this._connect({ baseUrl, jwt, language }).catch(() => {
            // Nothing is waiting on this one: it is the connection being made ready ahead of time, and a failure has
            // already scheduled the next attempt.
        });
    }

    /**
     * Transcribes one utterance.
     *
     * @param {string} base64Wav - The whole WAV file, header included, Base64 encoded.
     * @param {number} timeoutMs - How long to wait for the answer.
     * @param {string} jwt - The token to authenticate with, if there is one.
     * @returns {Promise<string>} What the service heard, empty when it heard nothing.
     */
    transcribe(
            wav: ArrayBuffer | ArrayBufferView,
            timeoutMs: number,
            options: ITranscriptionConnectionOptions = {}): Promise<string | null> {
        const request = this._chain
            .catch(() => { /* Whatever the previous caller ran into is theirs, not ours. */ })
            .then(() => this._transcribeNow(wav, timeoutMs, options));

        // The chain must not hold on to a rejection, or every later caller inherits it.
        this._chain = request.catch(() => { /* Reported to whoever asked. */ });

        return request;
    }

    /**
     * Closes the connection and fails whatever was waiting on it. To be called when the call is over.
     *
     * @returns {void}
     */
    close() {
        logger.info(`${TAG} closing for good after ${this._attempts} connection(s) and `
            + `${this._utterances} utterance(s); connected=${this.connected}`);

        this._wanted = false;
        this._settle(null);
        this._openAgainAt = 0;
        this._rejectedJwt = undefined;
        this._cancelReconnect();
        this._teardownSocket();
    }

    /**
     * Sends one utterance and waits for the answer.
     *
     * @param {string} base64Wav - The whole WAV file, Base64 encoded.
     * @param {number} timeoutMs - How long to wait.
     * @param {string} jwt - The token to authenticate with.
     * @returns {Promise<string>}
     */
    private async _transcribeNow(
            wav: ArrayBuffer | ArrayBufferView,
            timeoutMs: number,
            options: ITranscriptionConnectionOptions): Promise<string | null> {
        const socket = await this._connect(options);

        const result = await new Promise<ITranscriptionResult | null>(resolve => {
            this._pending = {
                resolve,

                // A frame which never arrives must not wedge every utterance behind it. The socket goes with it: the
                // answer may still be coming, and it would be read as the answer to somebody else's sentence.
                timeout: setTimeout(() => {
                    logger.warn(`${TAG} no answer within ${timeoutMs}ms; dropping the socket and reopening it`);
                    this._settle(null);
                    this._teardownSocket();

                    // Dropped on purpose rather than because the network went away, so the replacement is opened now
                    // instead of after the usual wait: the next sentence should not have to wait for it.
                    this._reopenNow(options);
                }, timeoutMs)
            };

            try {
                const bytes = this._toBytes(wav);
                const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

                logger.info(`${TAG} sending utterance ${++this._utterances} (${Math.round(bytes.byteLength / 1024)}kB)`);
                socket.send(payload);
            } catch (error) {
                logger.warn(`${TAG} the utterance could not be put on the socket: ${error}`);
                this._settle(null);
                this._teardownSocket();
            }
        });

        if (result === null) {
            return null;
        }

        if (result.status && result.status !== 'success') {
            return null;
        }

        // The only place in this pipeline where anything says which language was actually spoken. Nothing acts on it -
        // the translation service detects the source itself - but it is worth seeing in a log while the call is young.
        if (result.detected_language) {
            logger.info(`Transcribed an utterance the service heard as ${result.detected_language}`);
        }

        return String(result.transcription ?? '').trim() || null;
    }

    /**
     * Returns an open socket, opening one if there is not one already.
     *
     * @param {string} jwt - The token to authenticate with.
     * @returns {Promise<WebSocket>}
     */
    private _connect(options: ITranscriptionConnectionOptions = {}): Promise<WebSocket> {
        const { baseUrl, jwt, language } = options;
        const url = baseUrl || MELP_TRANSCRIBE_WS_URL;
        const expectedLanguage = language || TRANSCRIBE_LANGUAGE;

        // A token which has been refreshed since the socket was opened has to open a new one: the service authorized
        // this connection against the old token and will not be told about the new one any other way.
        if (this._socket
                && (this._socketJwt !== jwt
                    || this._socketBaseUrl !== url
                    || this._socketLanguage !== expectedLanguage)) {
            logger.info(`${TAG} the token was refreshed; dropping the connection it authorized`);
            this._teardownSocket();
        }

        if (this._socket?.readyState === WebSocket.OPEN) {
            return Promise.resolve(this._socket);
        }

        if (this._connecting) {
            logger.debug(`${TAG} a handshake is already under way; waiting for it`);

            return this._connecting;
        }

        if (jwt && jwt === this._rejectedJwt) {
            logger.warn(`${TAG} not connecting: this token was refused, waiting for a refreshed one`);

            return Promise.reject(
                new TranscriptionUnreachableError('The transcription service rejected this token'));
        }

        if (Date.now() < this._openAgainAt) {
            logger.info(`${TAG} not connecting for another ${this._openAgainAt - Date.now()}ms; `
                + 'this utterance goes to the fallback');

            return Promise.reject(
                new TranscriptionUnreachableError('The transcription service is not answering'));
        }

        // Cleared only if it is still the attempt which set it: one abandoned by a teardown must not clear whichever
        // attempt replaced it, or the next caller opens a second socket.
        const attempt: Promise<WebSocket> = this._open({ baseUrl: url, jwt, language: expectedLanguage })
            .finally(() => {
                if (this._connecting === attempt) {
                    this._connecting = undefined;
                }
            });

        this._connecting = attempt;

        return attempt;
    }

    /**
     * Opens the socket and resolves once the service has accepted the handshake.
     *
     * @param {string} jwt - The token to authenticate with.
     * @returns {Promise<WebSocket>}
     */
    private _open(options: ITranscriptionConnectionOptions = {}): Promise<WebSocket> {
        const { baseUrl, jwt, language } = options;
        const generation = this._generation;
        const attempt = ++this._attempts;
        const startedAt = Date.now();

        logger.info(`${TAG} connecting (attempt ${attempt}) to ${this._loggableUrl(options)}`);

        return new Promise<WebSocket>((resolve, reject) => {
            let socket: WebSocket;

            try {
                socket = new WebSocket(this._url(options));
            } catch (error) {
                logger.warn(`${TAG} attempt ${attempt} could not even be started: ${error}`);
                this._noteReconnectFailure();
                this._scheduleReconnect({ baseUrl, jwt, language });
                reject(new TranscriptionUnreachableError(`${MELP_TRANSCRIBE_WS_URL} could not be opened: ${error}`));

                return;
            }

            let settled = false;

            // A handshake which neither completes nor fails would otherwise leave every utterance waiting on it.
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }

                settled = true;
                logger.warn(`${TAG} attempt ${attempt} gave up after `
                    + `${TRANSCRIBE_WS_CONNECT_TIMEOUT_MS}ms: the handshake was never answered`);
                this._noteReconnectFailure();
                this._scheduleReconnect({ baseUrl, jwt, language });

                try {
                    socket.close();
                } catch (error) {
                    logger.warn('Could not close a transcription socket which never opened', error);
                }

                reject(new TranscriptionUnreachableError(`${MELP_TRANSCRIBE_WS_URL} did not answer the handshake`));
            }, TRANSCRIBE_WS_CONNECT_TIMEOUT_MS);

            socket.onopen = () => {
                clearTimeout(timeout);

                if (settled) {
                    return;
                }

                settled = true;

                // Abandoned while it was opening, by a call which ended or by a token which was refreshed. Installing
                // it now would leave a connection nobody asked for open for the rest of the meeting.
                if (generation !== this._generation) {
                    logger.info(`${TAG} attempt ${attempt} opened but is no longer wanted; closing it again`);

                    try {
                        socket.close();
                    } catch (error) {
                        logger.warn('Could not close a transcription socket which is no longer wanted', error);
                    }

                    reject(new TranscriptionUnreachableError('The transcription connection was no longer wanted'));

                    return;
                }

                this._socket = socket;
                this._socketJwt = jwt;
                this._socketBaseUrl = baseUrl || MELP_TRANSCRIBE_WS_URL;
                this._socketLanguage = language || TRANSCRIBE_LANGUAGE;
                this._openAgainAt = 0;
                this._reconnectDelayMs = TRANSCRIBE_WS_RECONNECT_DELAY_MS;
                this._openedAt = Date.now();
                this._rejectedJwt = undefined;
                this._startHeartbeat();
                logger.info(`${TAG} CONNECTED on attempt ${attempt} after ${Date.now() - startedAt}ms`);
                resolve(socket);
            };

            socket.onmessage = event => {
                if (generation === this._generation) {
                    this._onMessage(event);
                }
            };

            socket.onerror = () => {
                // No detail is available: the platform reports a socket error without saying what it was.
                logger.warn(`${TAG} attempt ${attempt} reported a socket error`);
            };

            socket.onclose = event => {
                clearTimeout(timeout);

                const wasUp = this._openedAt ? `${Date.now() - this._openedAt}ms` : 'never opened';

                logger.warn(`${TAG} DISCONNECTED: attempt ${attempt} closed with code `
                    + `${event?.code ?? 'none'} (${event?.reason || 'no reason given'}), up for ${wasUp}`);

                if (event?.code === CLOSE_CODE_AUTH_FAILED) {
                    logger.warn(`${TAG} the service refused the token; not reconnecting until it is refreshed`);
                    this._rejectedJwt = jwt;
                }

                // A socket which has been superseded must not take its successor's request down as it closes, nor
                // clear the connection which replaced it.
                if (generation !== this._generation) {
                    return;
                }

                this._socket = undefined;
                this._socketJwt = undefined;
                this._socketBaseUrl = undefined;
                this._socketLanguage = undefined;
                this._openedAt = 0;
                this._generation++;
                this._noteReconnectFailure();
                this._settle(null);

                // Put it back up, unless the token is what was refused - retrying that is what the rejected token is
                // remembered for - or unless nobody wants a connection any more.
                if (event?.code !== CLOSE_CODE_AUTH_FAILED) {
                    this._scheduleReconnect({ baseUrl, jwt, language });
                }

                if (!settled) {
                    settled = true;
                    reject(new TranscriptionUnreachableError(
                        `${MELP_TRANSCRIBE_WS_URL} refused the connection with ${event?.code ?? 'no code'}`));
                }
            };
        });
    }

    /**
     * Hands one answer to whoever is waiting for it.
     *
     * @param {Object} event - The message event the socket raised.
     * @returns {void}
     */
    private _onMessage(event: { data?: any; }) {
        const pending = this._pending;

        if (!pending) {
            // Nothing is waiting. Either the service answered the idle ping, which is ordinary and says only that the
            // connection is alive, or this is the late answer to something which already timed out - dropped rather
            // than kept, because attributing it to the next utterance would put one speaker's words under another's.
            if (this._looksLikeATranscript(event?.data)) {
                logger.warn(`${TAG} dropped a transcription nothing was waiting for`);
            } else {
                logger.debug(`${TAG} the connection answered the idle ping`);
            }

            return;
        }

        if (typeof event?.data !== 'string') {
            this._settle(null);

            return;
        }

        let result: ITranscriptionResult;

        try {
            result = JSON.parse(event.data);
        } catch (error) {
            this._settle(null);

            return;
        }

        clearTimeout(pending.timeout);
        this._pending = undefined;
        logger.info(`${TAG} answer received: status=${result.status ?? 'none'}, `
            + `${result.transcription ? `${String(result.transcription).length} chars` : 'nothing heard'}, `
            + `service took ${result.transcription_time_sec ?? '?'}s`);

        // Said twice on purpose, for the reason the s2s-v2 channel logs are: the logger reaches the native log, which
        // is where it belongs and where it is kept, and the console reaches whoever is watching the packager, which is
        // where somebody debugging a transcript that never arrived is actually looking. On React Native the two are
        // not the same place, so a frame sent to only one of them is invisible from the other.
        console.log(`${TAG} answer received`, result);
        pending.resolve(result);
    }

    /**
     * Fails whatever is waiting for an answer, if anything is.
     *
     * @param {Error} error - Why it will not get one.
     * @returns {void}
     */
    private _settle(result: ITranscriptionResult | null) {
        const pending = this._pending;

        if (!pending) {
            return;
        }

        this._pending = undefined;
        clearTimeout(pending.timeout);
        if (result === null) {
            pending.resolve(null);
        } else {
            pending.resolve(result);
        }
    }

    /**
     * Puts the connection back up in a moment, if one is still wanted.
     *
     * @param {string} jwt - The token to authenticate with.
     * @returns {void}
     */
    private _scheduleReconnect(options: ITranscriptionConnectionOptions = {}) {
        const { baseUrl, jwt, language } = options;

        if (!this._wanted) {
            logger.info(`${TAG} not reconnecting: no call wants a connection`);

            return;
        }

        if (this._reconnect) {
            return;
        }

        logger.info(`${TAG} will try again in ${this._reconnectDelayMs}ms`);

        this._reconnect = setTimeout(() => {
            this._reconnect = undefined;

            if (!this._wanted) {
                logger.info(`${TAG} the retry is no longer wanted; staying closed`);

                return;
            }

            this._openAgainAt = 0;
            this._connect({ baseUrl, jwt, language }).catch(() => {
                // Reported where it happened, and the next attempt is already scheduled by whatever failed.
            });
        }, this._reconnectDelayMs);
    }

    /**
     * Puts the connection back up straight away, if one is still wanted. For a socket this client dropped itself, where
     * there is nothing to wait out.
     *
     * @param {string} jwt - The token to authenticate with.
     * @returns {void}
     */
    private _reopenNow(options: ITranscriptionConnectionOptions = {}) {
        if (!this._wanted) {
            return;
        }

        logger.info(`${TAG} reconnecting straight away: this client dropped the socket itself`);
        this._openAgainAt = 0;
        this._connect(options).catch(() => {
            // Reported where it happened, and the next attempt is already scheduled by whatever failed.
        });
    }

    /**
     * Drops a reconnect which is no longer wanted.
     *
     * @returns {void}
     */
    private _cancelReconnect() {
        if (this._reconnect) {
            clearTimeout(this._reconnect);
            this._reconnect = undefined;
        }
    }

    /**
     * Holds off opening the socket again for a moment, so that a service which is down is not dialled once per
     * utterance.
     *
     * @returns {void}
     */
    private _backOff() {
        this._openAgainAt = Date.now() + this._reconnectDelayMs;
    }

    /**
     * Returns whether an unexpected frame is an answer to an utterance rather than to the idle ping.
     *
     * @param {any} data - Whatever arrived.
     * @returns {boolean}
     */
    private _looksLikeATranscript(data: any): boolean {
        if (typeof data !== 'string') {
            return true;
        }

        try {
            const frame = JSON.parse(data);

            return 'transcription' in frame || 'status' in frame;
        } catch (error) {
            return true;
        }
    }

    /**
     * Starts pinging an idle connection, so that one which has quietly stopped existing is found out.
     *
     * @returns {void}
     */
    private _startHeartbeat() {
        this._stopHeartbeat();

        this._heartbeat = setInterval(() => {
            const socket = this._socket;

            // Never while something is waiting for an answer. Frames carry no request identifier and are matched to
            // requests by arrival alone, so a reply to a ping landing on a waiting utterance would hand one speaker's
            // words to another. Silence is also the only time the ping is needed: a connection carrying audio is
            // already proving itself.
            if (!socket || socket.readyState !== WebSocket.OPEN || this._pending) {
                return;
            }

            try {
                socket.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
                logger.warn(`${TAG} the idle ping could not be sent; dropping the connection`, error);
                this._teardownSocket();
                this._noteReconnectFailure();
                this._scheduleReconnect();
            }
        }, TRANSCRIBE_WS_HEARTBEAT_MS);
    }

    /**
     * Stops pinging.
     *
     * @returns {void}
     */
    private _stopHeartbeat() {
        if (this._heartbeat) {
            clearInterval(this._heartbeat);
            this._heartbeat = undefined;
        }
    }

    /**
     * Increases the reconnect delay after an unexpected failure.
     *
     * @returns {void}
     */
    private _noteReconnectFailure() {
        this._backOff();
        this._reconnectDelayMs = Math.min(
            Math.max(TRANSCRIBE_WS_RECONNECT_DELAY_MS, this._reconnectDelayMs * 2),
            15 * 1000);
    }

    /**
     * Drops the socket, without waiting for it to close.
     *
     * @returns {void}
     */
    private _teardownSocket() {
        const socket = this._socket;

        this._stopHeartbeat();

        this._socket = undefined;
        this._socketJwt = undefined;
        this._socketBaseUrl = undefined;
        this._socketLanguage = undefined;

        // Bumped whether or not there is a socket to drop: a handshake which is still in flight is abandoned by this
        // too, and it has nothing here to clear.
        this._generation++;
        this._connecting = undefined;

        if (!socket) {
            return;
        }

        // Cleared first: the close this triggers must not be read as the service having dropped us.
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;

        try {
            socket.close();
        } catch (error) {
            logger.warn('Could not close the transcription socket', error);
        }
    }

    /**
     * Returns the address to open, with everything the handshake settles on the query string.
     *
     * @param {string} jwt - The token to authenticate with, if there is one.
     * @returns {string}
     */
    private _url(options: ITranscriptionConnectionOptions = {}): string {
        const { baseUrl, jwt, language } = options;
        const endpoint = baseUrl || MELP_TRANSCRIBE_WS_URL;
        const query = [
            `mode=${encodeURIComponent(TRANSCRIBE_MODE)}`,
            `language=${encodeURIComponent(language || TRANSCRIBE_LANGUAGE)}`
        ];

        if (jwt) {
            query.push(`auth_token=${encodeURIComponent(jwt)}`);
        }

        return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query.join('&')}`;
    }

    /**
     * Returns the address as it may be written to a log.
     *
     * The token travels on the query string, and a log is exactly the place it must not end up: logs are pasted into
     * issues and shipped off devices. Only whether there was one is worth knowing.
     *
     * @param {string} jwt - The token the connection is being opened with, if there is one.
     * @returns {string}
     */
    private _loggableUrl(options: ITranscriptionConnectionOptions = {}): string {
        const { baseUrl, jwt, language } = options;
        const endpoint = baseUrl || MELP_TRANSCRIBE_WS_URL;

        return `${endpoint}?mode=${TRANSCRIBE_MODE}&language=${language || TRANSCRIBE_LANGUAGE}`
            + `&auth_token=${jwt ? '<redacted>' : '<none>'}`;
    }

    /**
     * Normalizes a binary payload into a Uint8Array for WebSocket.send().
     *
     * @param {ArrayBuffer|ArrayBufferView} wav - The WAV bytes.
     * @returns {Uint8Array}
     */
    private _toBytes(wav: ArrayBuffer | ArrayBufferView): Uint8Array {
        if (wav instanceof ArrayBuffer) {
            return new Uint8Array(wav);
        }

        return new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength);
    }
}
