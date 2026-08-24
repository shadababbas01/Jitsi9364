import base64js from 'base64-js';

import { getLocalMicRecorderNativeModule } from '../../audio-extraction/functions.native';
import {
    MELP_TRANSCRIBE_URL,
    MELP_TRANSCRIBE_WS_URL,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_MODE,
    TRANSCRIBE_TIMEOUT_MS
} from '../constants';
import logger from '../logger';

import MelpSttClient, { ITranscriptionConnectionOptions } from './MelpSttClient';
import { TranscriptionUnreachableError } from './TranscriptionError';

export { TranscriptionUnreachableError };

/**
 * The socket the utterances go over. One for the whole application: it holds a single connection open for the length of
 * a call, and two of them would be two connections transcribing the same microphone.
 */
const socket = new MelpSttClient();

/**
 * What the websocket transcription path needs to know about a request.
 */
export interface ITranscribeSocketOptions extends ITranscriptionConnectionOptions {
    timeoutMs?: number;
}

/**
 * How an utterance is transcribed, and in which order the ways are tried.
 *
 * There are two because either can be the one that is up. The socket is what the service is built around now: one
 * connection is held open for the call rather than a handshake being paid for every few seconds. The request-per-
 * utterance endpoint the pipeline was originally written against is kept behind it as the fallback for when the socket
 * cannot be reached at all.
 *
 * The socket is always tried first rather than the one which answered last. A socket which is down is not dialled once
 * per utterance - the client holds off for {@code TRANSCRIBE_WS_RECONNECT_DELAY_MS} and refuses immediately in the
 * meantime - so trying it first costs nothing while it is out, and a call which fell back to the fallback finds its way
 * back to the socket on its own rather than staying downgraded for the rest of the meeting.
 */
const ROUTES: Array<{
    transcribe: (
        audioPath: string,
        fileName: string,
        timeoutMs: number,
        options: ITranscribeOptions & ITranscribeSocketOptions
    ) => Promise<string>;
    url: string;
}> = [
    {
        transcribe: _transcribeOverSocket,
        url: MELP_TRANSCRIBE_WS_URL
    },
    {
        transcribe: _transcribeOverHttp,
        url: MELP_TRANSCRIBE_URL
    }
];

/**
 * Reads the transcript out of a document answer, which carries one entry per uploaded file.
 *
 * @param {string} body - What the service answered.
 * @returns {string}
 */
function _parseResults(body: string): string {
    const [ result ] = JSON.parse(body)?.results ?? [];

    if (!result || (result.status && result.status !== 'success')) {
        throw new Error(`The transcription service could not read the utterance: ${result?.status ?? 'no result'}`);
    }

    // The only place in this pipeline where anything says which language was actually spoken. Nothing acts on it yet -
    // the translation service detects the source itself - but it is worth seeing in a log while the call is young.
    if (result.detected_language) {
        logger.info(`Transcribed an utterance the service heard as ${result.detected_language}`);
    }

    return String(result.transcription ?? '').trim();
}

/**
 * Transcribes an utterance over the socket.
 *
 * The whole file goes up as one binary WAV frame, which is what the service takes. Reading it off the disk is the
 * recorder's job: JavaScript never sees the samples and cannot open the file itself.
 *
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {string} _fileName - Unused: the frame is the audio and nothing else, so there is nothing to name.
 * @param {number} timeoutMs - How long to wait.
 * @param {ITranscribeOptions & ITranscribeSocketOptions} options - How to reach the socket.
 * @returns {Promise<string>}
 */
async function _transcribeOverSocket(
        audioPath: string,
        _fileName: string,
        timeoutMs: number,
        options: ITranscribeOptions & ITranscribeSocketOptions): Promise<string> {
    const text = await transcribeWavOverSocket(audioPath, {
        ...options,
        timeoutMs
    });

    return text ?? '';
}

/**
 * Transcribes an utterance over the socket, returning null when the service could not hear it or answer it.
 *
 * The recorder still writes the WAV to disk, but the frame sent over the wire is the raw binary WAV payload rather
 * than Base64 or multipart form data.
 *
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {ITranscribeSocketOptions} options - How to reach the socket and how long to wait for it.
 * @returns {Promise<string|null>}
 */
export async function transcribeWavOverSocket(
        audioPath: string,
        { baseUrl, jwt, language = TRANSCRIBE_LANGUAGE, timeoutMs = TRANSCRIBE_TIMEOUT_MS }: ITranscribeSocketOptions = {}
): Promise<string | null> {
    const recorder = getLocalMicRecorderNativeModule();

    if (!recorder?.readFileAsBase64) {
        // Nothing to read the file with, which is not the service being down: the fallback uploads the file itself and
        // can still transcribe this one.
        throw new Error('This build cannot read a recording back to put it on the transcription socket');
    }

    let base64: string;

    try {
        base64 = await recorder.readFileAsBase64(audioPath);
    } catch (error) {
        throw new Error(`The recorded utterance could not be read: ${error}`);
    }

    // Nothing was recorded, so there is nothing for the service to hear. Not worth a frame, and not a failure.
    if (!base64) {
        return null;
    }

    const bytes = base64js.toByteArray(base64);

    try {
        return await socket.transcribe(bytes, timeoutMs, {
            baseUrl,
            jwt,
            language
        });
    } catch (error) {
        if (error instanceof TranscriptionUnreachableError) {
            return null;
        }

        throw error;
    }
}

/**
 * Transcribes an utterance with one request of its own, as a {@code multipart/form-data} upload.
 *
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {string} fileName - What to call the file in the request.
 * @param {number} timeoutMs - How long to wait.
 * @returns {Promise<string>}
 */
async function _transcribeOverHttp(
        audioPath: string,
        fileName: string,
        timeoutMs: number,
        _options: ITranscribeOptions & ITranscribeSocketOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const body = new FormData();

        body.append('audio', {
            name: fileName,
            type: 'audio/wav',
            uri: audioPath.startsWith('file://') ? audioPath : `file://${audioPath}`
        } as any);
        body.append('mode', TRANSCRIBE_MODE);
        body.append('language', TRANSCRIBE_LANGUAGE);

        // Names the entry the service answers with.
        body.append('message_id', fileName.replace(/\.wav$/, ''));

        let response;

        try {
            response = await fetch(MELP_TRANSCRIBE_URL, {
                body,
                method: 'POST',
                signal: controller.signal
            });
        } catch (error) {
            // Nothing answered: a refused connection, a name which does not resolve, or the wait ran out.
            throw new TranscriptionUnreachableError(`${MELP_TRANSCRIBE_URL} could not be reached: ${error}`);
        }

        const rawResponse = await response.text();

        if (!response.ok) {
            throw new Error(`The transcription service answered ${response.status}: ${rawResponse}`);
        }

        return _parseResults(rawResponse);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * What a caller can say about how their utterance should be transcribed.
 */
export interface ITranscribeOptions {

    /**
     * The token the service authenticates the connection with. Passed in rather than held here, because it can be
     * refreshed while a call is running.
     */
    jwt?: string;

    /**
     * Whether the recording outlives its transcript. Off by default: a call hands over an utterance every few seconds
     * for its whole length and nothing opens them again, so leaving them behind grows the cache for the length of the
     * meeting. Callers which show their recordings back to the user ask to keep them.
     */
    keepAudio?: boolean;

    /**
     * How long to wait for the service. Callers recording a whole utterance rather than a fixed caption window need
     * longer than the default, since a longer clip takes longer to upload and to transcribe.
     */
    timeoutMs?: number;
}

/**
 * Sends a recorded WAV to the transcription service and returns what it heard.
 *
 * The routes are tried in turn, so that one being down costs a sentence rather than the whole call. An empty answer
 * means nothing was heard, which is not a failure.
 *
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {string} fileName - What to call the file in the request the fallback makes.
 * @param {ITranscribeOptions} options - How to go about it.
 * @returns {Promise<string>} The transcript, empty when the service heard nothing.
 */
export default async function transcribeWavFile(
        audioPath: string,
        fileName: string,
        options: ITranscribeOptions & ITranscribeSocketOptions = {}
): Promise<string> {
    const {
        baseUrl,
        jwt,
        keepAudio = false,
        language = TRANSCRIBE_LANGUAGE,
        timeoutMs = TRANSCRIBE_TIMEOUT_MS
    } = options;

    let unreachable = 0;
    let lastError: Error = new TranscriptionUnreachableError('No transcription service was tried');

    try {
        for (const route of ROUTES) {
            try {
                return await route.transcribe(audioPath, fileName, timeoutMs, {
                    baseUrl,
                    jwt,
                    keepAudio,
                    language,
                    timeoutMs
                });
            } catch (error) {
                lastError = error as Error;

                if (error instanceof TranscriptionUnreachableError) {
                    unreachable++;
                    logger.warn(`${route.url} is not answering`);
                } else {
                    logger.warn(`${route.url} refused an utterance`, error);
                }
            }
        }
    } finally {
        if (!keepAudio) {
            getLocalMicRecorderNativeModule()?.deleteFile?.(audioPath);
        }
    }

    // Every service refusing to answer at all is an outage, and the call can say so rather than blaming the sentence.
    if (unreachable === ROUTES.length) {
        throw new TranscriptionUnreachableError(String(lastError.message));
    }

    throw lastError;
}

/**
 * Opens the connection to the transcription service and keeps it open.
 *
 * To be called when a call starts. Without it the connection is made by the first thing anybody says, which pays for
 * the handshake out of that sentence, and a connection which drops during a silence is not noticed until somebody
 * speaks. With it the socket is up for the whole call and replaces itself if it goes.
 *
 * @param {string|ITranscriptionConnectionOptions} jwt - The token or connection options.
 * @returns {void}
 */
export function openTranscriptionConnection(jwt?: string | ITranscriptionConnectionOptions) {
    socket.open(typeof jwt === 'string' ? { jwt } : jwt);
}

/**
 * Closes the connection to the transcription service, and stops it being reopened. To be called when the call which was
 * using it is over.
 *
 * @returns {void}
 */
export function closeTranscriptionConnection() {
    socket.close();
}
