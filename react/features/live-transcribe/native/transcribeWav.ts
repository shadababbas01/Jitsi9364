import {
    MELP_TRANSCRIBE_TEXT_URL,
    MELP_TRANSCRIBE_URL,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_TEXT_MODE,
    TRANSCRIBE_TIMEOUT_MS
} from '../constants';
import logger from '../logger';

/**
 * Thrown when no transcription service could be reached at all, as opposed to one which answered and refused. The two
 * are worth telling apart: the first is an outage and says so, the second is something about the request.
 */
export class TranscriptionUnreachableError extends Error {}

/**
 * The services which can turn an utterance into text, in the order they are tried.
 *
 * There are two of them because they are two deployments of the same thing which answer differently, and either can be
 * the one that is up. The first is the direct one and hands back the transcript as a bare body; the second is the
 * endpoint the captions pipeline was written against and wraps it in a document, alongside the language it heard.
 */
const ROUTES = [
    {
        json: false,
        url: MELP_TRANSCRIBE_TEXT_URL
    },
    {
        json: true,
        url: MELP_TRANSCRIBE_URL
    }
];

/**
 * Which route answered last, so that a service which is down costs one refused connection rather than one per utterance
 * for the rest of the meeting.
 */
let preferred = 0;

/**
 * Reads the transcript out of a bare-body answer.
 *
 * Surrounding quotes are dropped in case the service hands back a quoted string, and the whitespace around it with
 * them.
 *
 * @param {string} body - What the service answered.
 * @returns {string}
 */
function _parseText(body: string): string {
    return body.trim().replace(/^"(.*)"$/s, '$1').trim();
}

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
 * Asks one service to transcribe an utterance.
 *
 * @param {Object} route - Which service, and how it answers.
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {string} fileName - What to call the file in the request.
 * @param {number} timeoutMs - How long to wait.
 * @returns {Promise<string>}
 */
async function _transcribe(
        route: { json: boolean; url: string; },
        audioPath: string,
        fileName: string,
        timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const body = new FormData();

        body.append('audio', {
            name: fileName,
            type: 'audio/wav',
            uri: audioPath.startsWith('file://') ? audioPath : `file://${audioPath}`
        } as any);
        body.append('mode', TRANSCRIBE_TEXT_MODE);
        body.append('language', TRANSCRIBE_LANGUAGE);

        // Only the document endpoint asks for one, and it names the entry it answers with.
        if (route.json) {
            body.append('message_id', fileName.replace(/\.wav$/, ''));
        }

        let response;

        try {
            response = await fetch(route.url, {
                body,
                method: 'POST',
                signal: controller.signal
            });
        } catch (error) {
            // Nothing answered: a refused connection, a name which does not resolve, or the wait ran out.
            throw new TranscriptionUnreachableError(`${route.url} could not be reached: ${error}`);
        }

        const rawResponse = await response.text();

        if (!response.ok) {
            throw new Error(`The transcription service answered ${response.status}: ${rawResponse}`);
        }

        return route.json ? _parseResults(rawResponse) : _parseText(rawResponse);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Sends a recorded WAV to the transcription service and returns what it heard.
 *
 * The services are tried in turn, starting with whichever answered last, so that one being down costs a sentence rather
 * than the whole call. An empty answer means nothing was heard, which is not a failure.
 *
 * @param {string} audioPath - Where the recorded WAV lives on disk.
 * @param {string} fileName - What to call the file in the request.
 * @param {number} timeoutMs - How long to wait for the service. Callers recording a whole utterance rather than a fixed
 * caption window need longer than the caption default, since a longer clip takes longer to upload and to transcribe.
 * @returns {Promise<string>} The transcript, empty when the service heard nothing.
 */
export default async function transcribeWavFile(
        audioPath: string,
        fileName: string,
        timeoutMs: number = TRANSCRIBE_TIMEOUT_MS
): Promise<string> {
    const order = [ preferred, ...ROUTES.map((_, index) => index).filter(index => index !== preferred) ];
    let unreachable = 0;
    let lastError: Error = new TranscriptionUnreachableError('No transcription service was tried');

    for (const index of order) {
        try {
            const transcript = await _transcribe(ROUTES[index], audioPath, fileName, timeoutMs);

            if (index !== preferred) {
                logger.info(`Transcribing through ${ROUTES[index].url} from now on`);
                preferred = index;
            }

            return transcript;
        } catch (error) {
            lastError = error as Error;

            if (error instanceof TranscriptionUnreachableError) {
                unreachable++;
                logger.warn(`${ROUTES[index].url} is not answering`);
            } else {
                logger.warn(`${ROUTES[index].url} refused an utterance`, error);
            }
        }
    }

    // Every service refusing to answer at all is an outage, and the call can say so rather than blaming the sentence.
    if (unreachable === order.length) {
        throw new TranscriptionUnreachableError(String(lastError.message));
    }

    throw lastError;
}
