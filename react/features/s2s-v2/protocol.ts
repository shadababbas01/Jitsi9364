/**
 * The wire format of the s2s-v2 channel, and nothing else.
 *
 * Deliberately free of redux, of the conference and of anything asynchronous: everything here is a pure function over
 * plain objects, so the protocol can be exercised on its own before any audio, any user interface or any network exists.
 * A shipped web client is on the other end of every one of these messages, so the field names, the action strings and
 * the constant values below are a contract and not an implementation detail.
 */

import {
    DEFAULT_SOURCE_LANGUAGE,
    PROCESSED_MESSAGE_LIMIT,
    S2S_V2_ENDPOINT,
    S2S_V2_SESSION_END,
    S2S_V2_SESSION_START,
    S2S_V2_TRANSCRIPT,
    TRANSCRIPT_LANGUAGE
} from './constants';

/**
 * The shape shared by everything the channel carries.
 */
export interface IS2SV2Message {
    action: string;
    name: string;
}

/**
 * Announces that a translated session is running. Sent by a moderator to the whole meeting when the session starts, and
 * to one participant at a time when somebody joins after it has.
 */
export interface IS2SV2SessionStart extends IS2SV2Message {

    /**
     * How the session identifies itself. Opaque to everybody but the moderator who made it.
     */
    sessionId: string;

    /**
     * Which language the speech service is told to expect.
     */
    sourceLanguage: string;

    /**
     * The participant who started it. The receiver checks this against the participant list before believing any of it.
     */
    startedBy: string;
}

/**
 * Announces that the session is over.
 */
export interface IS2SV2SessionEnd extends IS2SV2Message {
    sessionId: string;
}

/**
 * Carries one finished utterance, as English text. Never audio, and never a translation: each receiving device
 * translates into whichever language its own listener asked for.
 */
export interface IS2SV2Transcript extends IS2SV2Message {

    /**
     * Whether the utterance is complete. Always true: there are no interim transcripts. The field exists so that a
     * streaming speech service can be added later without a protocol bump.
     */
    isFinal: boolean;

    /**
     * How this utterance identifies itself. Receivers recognise a repeat by it.
     */
    messageId: string;

    /**
     * What was said, in English.
     */
    originalText: string;

    /**
     * Which session it belongs to. An utterance from a session which has ended is dropped rather than shown.
     */
    sessionId: string;

    /**
     * The language {@code originalText} is in. Always English.
     */
    sourceLanguage: string;

    /**
     * Who said it.
     */
    speakerId: string;

    /**
     * When they said it, by the speaker's own clock. Transcripts are ordered by this rather than by arrival, so that a
     * slow translation cannot reorder the conversation.
     */
    timestamp: number;
}

/**
 * Returns eight characters of randomness for a session to identify itself by.
 *
 * @returns {string}
 */
function _random8(): string {
    let out = '';

    while (out.length < 8) {
        out += Math.random().toString(36).slice(2);
    }

    return out.slice(0, 8);
}

/**
 * Returns a fresh session identifier.
 *
 * Made once, by the moderator who starts the session, and treated as opaque by everybody else - never parsed, only
 * compared. The shape matches what the web client generates so that the two are recognisably the same kind of thing in
 * a log.
 *
 * @returns {string}
 */
export function generateSessionId(): string {
    return `s2sv2-session-${Date.now()}-${_random8()}`;
}

/**
 * Returns a function which names one utterance after another.
 *
 * A counter rather than more randomness, because the pair of a millisecond and a counter cannot collide with itself on
 * the one device which issues them, and every device prefixes its own.
 *
 * @returns {Function}
 */
export function createMessageIdFactory(): () => string {
    let counter = 0;

    return () => `s2sv2-${Date.now()}-${++counter}`;
}

/**
 * Builds the announcement that a session has started.
 *
 * @param {string} sessionId - How the session identifies itself.
 * @param {string} startedBy - The moderator starting it.
 * @param {string} sourceLanguage - Which language the speech service should expect.
 * @returns {IS2SV2SessionStart}
 */
export function buildSessionStart(
        sessionId: string,
        startedBy: string,
        sourceLanguage: string = DEFAULT_SOURCE_LANGUAGE): IS2SV2SessionStart {
    return {
        action: S2S_V2_SESSION_START,
        name: S2S_V2_ENDPOINT,
        sessionId,
        sourceLanguage: sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
        startedBy
    };
}

/**
 * Builds the announcement that a session is over.
 *
 * @param {string} sessionId - The session which is ending.
 * @returns {IS2SV2SessionEnd}
 */
export function buildSessionEnd(sessionId: string): IS2SV2SessionEnd {
    return {
        action: S2S_V2_SESSION_END,
        name: S2S_V2_ENDPOINT,
        sessionId
    };
}

/**
 * Builds one utterance.
 *
 * @param {string} sessionId - The session it belongs to.
 * @param {string} messageId - How it identifies itself.
 * @param {string} speakerId - Who said it.
 * @param {string} originalText - What they said, in English.
 * @param {number} timestamp - When, by the speaker's clock.
 * @returns {IS2SV2Transcript}
 */
export function buildTranscript(
        sessionId: string,
        messageId: string,
        speakerId: string,
        originalText: string,
        timestamp: number = Date.now()): IS2SV2Transcript {
    return {
        action: S2S_V2_TRANSCRIPT,
        isFinal: true,
        messageId,
        name: S2S_V2_ENDPOINT,
        originalText,
        sessionId,
        sourceLanguage: TRANSCRIPT_LANGUAGE,
        speakerId,
        timestamp
    };
}

/**
 * Returns whether a received payload is one of ours.
 *
 * The channel is shared with several other features, so anything which is not ours is not a fault and is not worth a
 * warning - it is simply somebody else's message.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isS2SV2Message(payload: any): payload is IS2SV2Message {
    return typeof payload === 'object'
        && payload !== null
        && payload.name === S2S_V2_ENDPOINT
        && typeof payload.action === 'string';
}

/**
 * Returns whether a message of ours is a well formed session announcement.
 *
 * @param {IS2SV2Message} message - The message to check.
 * @returns {boolean}
 */
export function isSessionStart(message: IS2SV2Message): message is IS2SV2SessionStart {
    const candidate = message as IS2SV2SessionStart;

    return message.action === S2S_V2_SESSION_START
        && typeof candidate.sessionId === 'string'
        && Boolean(candidate.sessionId)
        && typeof candidate.startedBy === 'string'
        && Boolean(candidate.startedBy);
}

/**
 * Returns whether a message of ours is a well formed end of session.
 *
 * @param {IS2SV2Message} message - The message to check.
 * @returns {boolean}
 */
export function isSessionEnd(message: IS2SV2Message): message is IS2SV2SessionEnd {
    const candidate = message as IS2SV2SessionEnd;

    return message.action === S2S_V2_SESSION_END
        && typeof candidate.sessionId === 'string'
        && Boolean(candidate.sessionId);
}

/**
 * Returns whether a message of ours is a well formed utterance.
 *
 * @param {IS2SV2Message} message - The message to check.
 * @returns {boolean}
 */
export function isTranscript(message: IS2SV2Message): message is IS2SV2Transcript {
    const candidate = message as IS2SV2Transcript;

    return message.action === S2S_V2_TRANSCRIPT
        && typeof candidate.sessionId === 'string'
        && typeof candidate.messageId === 'string'
        && Boolean(candidate.messageId)
        && typeof candidate.speakerId === 'string'
        && typeof candidate.originalText === 'string';
}

/**
 * The message IDs which have already been dealt with, so that a redelivered message is recognised rather than spoken a
 * second time.
 *
 * Bounded: the oldest is forgotten once the set is full, because a repeat arriving that long after the original is not
 * something worth carrying a growing set for the length of a meeting to catch.
 */
export class ProcessedMessages {
    private _ids: Set<string> = new Set();
    private _limit: number;

    /**
     * Initializes a new {@code ProcessedMessages} instance.
     *
     * @param {number} limit - How many to remember.
     */
    constructor(limit: number = PROCESSED_MESSAGE_LIMIT) {
        this._limit = limit;
    }

    /**
     * Remembers a message ID, and says whether it was already known.
     *
     * Deliberately one operation rather than two: a check followed by a separate insert leaves a window in which the
     * same message can be admitted twice.
     *
     * @param {string} messageId - The ID to remember.
     * @returns {boolean} Whether this is the first time the ID has been seen.
     */
    add(messageId: string): boolean {
        if (this._ids.has(messageId)) {
            return false;
        }

        this._ids.add(messageId);

        while (this._ids.size > this._limit) {
            const oldest = this._ids.values().next();

            if (oldest.done) {
                break;
            }

            this._ids.delete(oldest.value);
        }

        return true;
    }

    /**
     * Forgets everything, for when a session ends.
     *
     * @returns {void}
     */
    clear() {
        this._ids.clear();
    }
}
