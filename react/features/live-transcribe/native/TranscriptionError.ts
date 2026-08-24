/**
 * Thrown when no transcription service could be reached at all, as opposed to one which answered and refused. The two
 * are worth telling apart: the first is an outage and says so, the second is something about the request.
 *
 * In its own module because both the socket client and the fallback request raise it, and the socket client is what the
 * fallback falls back from: having either import the other would be a cycle.
 */
export class TranscriptionUnreachableError extends Error {}
