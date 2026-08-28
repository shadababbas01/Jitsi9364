/**
 * The wire format of Live Speech Translation, and nothing else.
 *
 * Deliberately free of redux, of the conference and of anything asynchronous: everything here is a pure function over
 * plain objects, so the protocol can be exercised on its own before any audio, any user interface or any network
 * exists.
 *
 * A shipped web client is on the other end of every one of these messages, so the field names, the tags and the
 * constant values below are a contract rather than an implementation detail. Note that the contract is not uniform:
 * the control plane tags itself with {@code type}, the listener and transcript planes with {@code name}. That is not a
 * tidy design and it is not ours to tidy - matching it exactly is the whole point.
 *
 * Live captions used to be produced by a Jigasi transcriber bot, and a bot joining the room is a presence event
 * everybody receives, so "are captions on" synchronized itself for free. The client-STT path which replaced it has no
 * such mechanism: every device transcribes its own microphone, and whether captions are on was purely local state with
 * nothing propagating it. This channel is what closes that gap.
 */

/**
 * Enables or disables Live Speech Translation for the whole conference.
 */
export const CC_CAPTIONS_CONTROL = 'cc-captions-control';

/**
 * Asks the room whether Live Speech Translation is already running. Sent by a device which has only just joined.
 */
export const CC_CAPTIONS_STATE_REQUEST = 'cc-captions-state-request';

/**
 * Answers {@link CC_CAPTIONS_STATE_REQUEST}, sent by anybody who already has it on.
 */
export const CC_CAPTIONS_STATE_ACK = 'cc-captions-state-ack';

/**
 * Synchronizes the microphone effect the captions own.
 */
export const CC_NOISE_SUPPRESSION = 'cc-noise-suppression';

/**
 * The name the listener plane tags itself with.
 */
export const LIVE_SPEECH_TRANSLATION = 'live-speech-translation';

export const LISTENER_SUBSCRIBE = 'subscribe';
export const LISTENER_UNSUBSCRIBE = 'unsubscribe';

/**
 * The name the transcript plane tags itself with, and the action on it.
 *
 * Shared with the speech-to-speech feature for compatibility, which is the single most dangerous thing in this file: a
 * transcript published by the caption flow is indistinguishable by its tag from one published by a translated session,
 * and a receiver which takes it for the latter will read it out loud. See {@link carriesParticipant}.
 */
export const TRANSCRIPT_NAME = 's2s-v2';
export const TRANSCRIPT_ACTION = 'transcript';

/**
 * The longest transcript accepted from a remote participant, in characters. Nothing anybody says in one utterance
 * comes close, so anything longer is malformed or hostile rather than speech.
 */
export const MAX_TRANSCRIPT_LENGTH = 10000;

/**
 * How many transcript IDs are remembered in order to recognise one which has already been handled.
 */
export const PROCESSED_TRANSCRIPT_LIMIT = 2000;

/**
 * Announces that Live Speech Translation has been turned on or off.
 */
export interface ICaptionsControl {
    enabled: boolean;
    startedBy?: string;
    type: string;
}

/**
 * Asks whoever already has it on to say so.
 */
export interface ICaptionsStateRequest {
    requesterId: string;
    type: string;
}

/**
 * Answers that question, addressed to the participant who asked.
 */
export interface ICaptionsStateAck {
    enabled: boolean;
    startedBy?: string;
    targetId: string;
    type: string;
}

/**
 * Synchronizes the microphone effect the captions own.
 */
export interface INoiseSuppression {
    enabled: boolean;
    type: string;
}

/**
 * Subscribes to, or unsubscribes from, the transcript feed.
 */
export interface IListenerState {
    action: string;
    name: string;
    participantId: string;
}

/**
 * One finished utterance, as English text.
 */
export interface ITranscriptMessage {
    action: string;
    isFinal: boolean;
    messageId: string;
    name: string;
    originalText: string;
    participant?: {
        avatar_url?: string;
        id?: string;
        name?: string;
    };
    sessionId: string;
    sourceLanguage: string;
    speakerId: string;
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
 * Shaped like the one the translated session feature generates so that the two are recognisably the same kind of thing
 * in a log. Receivers treat it as opaque: in this flow it is only ever checked for being present.
 *
 * @returns {string}
 */
export function generateCaptionsSessionId(): string {
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
export function createTranscriptIdFactory(): () => string {
    let counter = 0;

    return () => `s2sv2-${Date.now()}-${++counter}`;
}

/**
 * Builds the announcement that Live Speech Translation has been turned on or off.
 *
 * @param {boolean} enabled - Whether it is on.
 * @param {string} startedBy - Who turned it on.
 * @returns {ICaptionsControl}
 */
export function buildCaptionsControl(enabled: boolean, startedBy?: string): ICaptionsControl {
    return {
        enabled,
        startedBy,
        type: CC_CAPTIONS_CONTROL
    };
}

/**
 * Builds the question a device asks when it joins.
 *
 * @param {string} requesterId - Who is asking.
 * @returns {ICaptionsStateRequest}
 */
export function buildCaptionsStateRequest(requesterId: string): ICaptionsStateRequest {
    return {
        requesterId,
        type: CC_CAPTIONS_STATE_REQUEST
    };
}

/**
 * Builds the answer to that question.
 *
 * @param {boolean} enabled - Whether it is on here.
 * @param {string} targetId - Who asked, so that everybody else can ignore the answer.
 * @param {string} startedBy - Who turned it on.
 * @returns {ICaptionsStateAck}
 */
export function buildCaptionsStateAck(enabled: boolean, targetId: string, startedBy?: string): ICaptionsStateAck {
    return {
        enabled,
        startedBy,
        targetId,
        type: CC_CAPTIONS_STATE_ACK
    };
}

/**
 * Builds the microphone effect announcement.
 *
 * @param {boolean} enabled - Whether the effect is wanted.
 * @returns {INoiseSuppression}
 */
export function buildNoiseSuppression(enabled: boolean): INoiseSuppression {
    return {
        enabled,
        type: CC_NOISE_SUPPRESSION
    };
}

/**
 * Builds a subscription, or the withdrawal of one.
 *
 * @param {boolean} subscribe - Whether this device wants the transcript feed.
 * @param {string} participantId - Who this device is.
 * @returns {IListenerState}
 */
export function buildListenerState(subscribe: boolean, participantId: string): IListenerState {
    return {
        action: subscribe ? LISTENER_SUBSCRIBE : LISTENER_UNSUBSCRIBE,
        name: LIVE_SPEECH_TRANSLATION,
        participantId
    };
}

/**
 * Builds one finished utterance.
 *
 * The {@code participant} block is what tells a receiver this transcript came from the caption flow rather than from a
 * translated session, which matters because the two share a tag and only one of them may be read out loud.
 *
 * @param {Object} details - Everything the message carries.
 * @returns {ITranscriptMessage}
 */
export function buildTranscript({ avatarUrl, messageId, originalText, sessionId, speakerId, speakerName, timestamp }: {
    avatarUrl?: string;
    messageId: string;
    originalText: string;
    sessionId: string;
    speakerId: string;
    speakerName?: string;
    timestamp: number;
}): ITranscriptMessage {
    return {
        action: TRANSCRIPT_ACTION,
        isFinal: true,
        messageId,
        name: TRANSCRIPT_NAME,
        originalText,
        participant: {
            avatar_url: avatarUrl,
            id: speakerId,
            name: speakerName
        },
        sessionId,
        sourceLanguage: 'en',
        speakerId,
        timestamp
    };
}

/**
 * Returns whether a received payload carries one of the control plane's tags.
 *
 * @param {any} payload - Whatever arrived.
 * @param {string} type - The tag to look for.
 * @returns {boolean}
 */
function _isType(payload: any, type: string): boolean {
    return typeof payload === 'object' && payload !== null && payload.type === type;
}

/**
 * Returns whether a payload is a well formed control message.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isCaptionsControl(payload: any): payload is ICaptionsControl {
    return _isType(payload, CC_CAPTIONS_CONTROL) && typeof payload.enabled === 'boolean';
}

/**
 * Returns whether a payload is a well formed state request.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isCaptionsStateRequest(payload: any): payload is ICaptionsStateRequest {
    return _isType(payload, CC_CAPTIONS_STATE_REQUEST);
}

/**
 * Returns whether a payload is a well formed acknowledgement.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isCaptionsStateAck(payload: any): payload is ICaptionsStateAck {
    return _isType(payload, CC_CAPTIONS_STATE_ACK) && typeof payload.enabled === 'boolean';
}

/**
 * Returns whether a payload is a well formed microphone effect announcement.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isNoiseSuppression(payload: any): payload is INoiseSuppression {
    return _isType(payload, CC_NOISE_SUPPRESSION) && typeof payload.enabled === 'boolean';
}

/**
 * Returns whether a payload is a well formed listener state.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isListenerState(payload: any): payload is IListenerState {
    return typeof payload === 'object'
        && payload !== null
        && payload.name === LIVE_SPEECH_TRANSLATION
        && (payload.action === LISTENER_SUBSCRIBE || payload.action === LISTENER_UNSUBSCRIBE);
}

/**
 * Returns whether a payload is a well formed final transcript.
 *
 * Everything the contract asks for is checked, the length ceiling included: a transcript is shown to the whole room on
 * the strength of one message, so a malformed one is dropped rather than rendered.
 *
 * @param {any} payload - Whatever arrived.
 * @returns {boolean}
 */
export function isTranscript(payload: any): payload is ITranscriptMessage {
    if (typeof payload !== 'object' || payload === null) {
        return false;
    }

    const text = typeof payload.originalText === 'string' ? payload.originalText.trim() : '';

    return payload.name === TRANSCRIPT_NAME
        && payload.action === TRANSCRIPT_ACTION

        // Exactly true, not merely truthy: there are no interim transcripts in this flow, and a receiver which
        // accepted them would show half a sentence and then show it again finished.
        && payload.isFinal === true
        && typeof payload.messageId === 'string' && payload.messageId.length > 0
        && typeof payload.sessionId === 'string' && payload.sessionId.length > 0
        && text.length > 0
        && text.length <= MAX_TRANSCRIPT_LENGTH;
}

/**
 * Returns whether a transcript names the participant who spoke it.
 *
 * The one thing which tells a caption transcript from a translated-session one, since the two share a tag. The caption
 * flow always sends the block; the translated session's own builder never does. A receiver uses this to decide whether
 * a transcript may be read out loud, so getting it wrong is audible.
 *
 * @param {any} payload - The transcript.
 * @returns {boolean}
 */
export function carriesParticipant(payload: any): boolean {
    return typeof payload?.participant === 'object' && payload.participant !== null;
}

/**
 * The transcript IDs which have already been dealt with, so that one redelivered is recognised rather than shown twice.
 *
 * Bounded: the oldest is forgotten once the set is full, because a repeat arriving that long after the original is not
 * worth carrying a growing set for the length of a meeting to catch.
 */
export class ProcessedTranscripts {
    private _ids: Set<string> = new Set();
    private _limit: number;

    /**
     * Initializes a new {@code ProcessedTranscripts} instance.
     *
     * @param {number} limit - How many to remember.
     */
    constructor(limit: number = PROCESSED_TRANSCRIPT_LIMIT) {
        this._limit = limit;
    }

    /**
     * Remembers an ID, and says whether it was already known.
     *
     * Deliberately one operation rather than two: a check followed by a separate insert leaves a window in which the
     * same transcript is admitted twice.
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
     * Forgets everything, for when a conference ends.
     *
     * @returns {void}
     */
    clear() {
        this._ids.clear();
    }
}
