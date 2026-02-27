export interface ITranscriptHistoryMessage {
    id: string;
    text: string;
    language?: string;
}

/**
 * Formats the transcript message for display by including the participant name
 * and the final or partial text.
 *
 * @param {Object} transcriptMessage - The transcript entry received from
 * the middleware.
 * @returns {string} - A human readable version of the transcript message.
 */
export function formatTranscriptMessage(transcriptMessage?: {
    participant?: { name?: string };
    final?: string;
    stable?: string;
    unstable?: string;
}): string {
    if (!transcriptMessage) {
        return '';
    }

    let text = transcriptMessage.participant?.name
        ? `${transcriptMessage.participant?.name}: `
        : '';

    if (transcriptMessage.final) {
        text += transcriptMessage.final;
    } else {
        text += (transcriptMessage.stable || '') + (transcriptMessage.unstable || '');
    }

    return text.trim();
}