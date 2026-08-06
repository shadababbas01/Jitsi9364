import {
    MELP_TRANSCRIBE_TEXT_URL,
    TRANSCRIBE_LANGUAGE,
    TRANSCRIBE_TEXT_MODE,
    TRANSCRIBE_TIMEOUT_MS
} from '../constants';

/**
 * Sends a recorded WAV straight to the transcription service and returns what it heard.
 *
 * The service answers with the transcript itself rather than a document containing it, so there is nothing to parse:
 * the body is only tidied up. Surrounding quotes are dropped in case it hands back a quoted string, and the whitespace
 * around it with them.
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

        const response = await fetch(MELP_TRANSCRIBE_TEXT_URL, {
            body,
            method: 'POST',
            signal: controller.signal
        });
        const rawResponse = await response.text();

        if (!response.ok) {
            throw new Error(`The transcription service answered ${response.status}: ${rawResponse}`);
        }

        return rawResponse.trim().replace(/^"(.*)"$/s, '$1').trim();
    } finally {
        clearTimeout(timeout);
    }
}
