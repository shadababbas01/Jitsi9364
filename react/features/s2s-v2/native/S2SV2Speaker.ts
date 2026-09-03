import { IReduxState } from '../../app/types';
import { rememberSpokenText } from '../../caption-tts/spokenText';
import { TTS_QUEUE_LIMIT } from '../constants';
import logger from '../logger';

import PiperAudioPlayer from './piper/PiperAudioPlayer';
import PiperTtsClient from './piper/PiperTtsClient';

/**
 * One sentence waiting to be read out.
 */
export interface IS2SV2Utterance {

    /**
     * Which language to read it in, as this listener chose it.
     */
    language: string;

    /**
     * The utterance it belongs to.
     */
    messageId: string;

    /**
     * What was said in English, before this listener's language was applied.
     *
     * Not read out and not shown - it is here only so that it can be remembered alongside the line which is spoken. The
     * microphone hears the translation, but the transcription service is asked for the translate task, which answers in
     * English whatever language it heard. So the string which comes back from an echo is English, and the only way to
     * recognise it is to have kept the English this line came from.
     */
    originalText: string;

    /**
     * Who said it, so that the right participant is turned down while it is being read.
     */
    speakerId: string;

    /**
     * The text to read.
     */
    text: string;

    /**
     * When it was said, by the speaker's clock. The queue is emptied in this order rather than in arrival order, so a
     * translation which took longer than the one after it cannot reorder the conversation.
     */
    timestamp: number;
}

/**
 * Reads translated sentences out loud, in the order they were said.
 *
 * Melp's Piper speech service does the speaking, over the one websocket kept open for {@link PiperTtsClient}. Every
 * listener in a language shares the one voice the service advertises for it - a room is told apart by whose name is
 * read in front of their first few sentences, not by which of several voices happened to be handed to them.
 *
 * The queue is short on purpose. A busy room says more than can be read out, and a backlog only falls further behind:
 * once it is full the oldest waiting sentence goes, because it is the one furthest behind the conversation.
 */
export default class S2SV2Speaker {
    /**
     * Told who is being read out, and which utterance it belongs to. Turning that speaker's own voice down, and
     * stopping this device from hearing itself, both hang off it.
     */
    private _onSpeakingChange: (speakerId: string | null, messageId: string | null) => void;

    /**
     * Told when the service cannot speak, so that a listener is not left waiting for audio which is not coming.
     */
    private _onError: () => void;

    private _client: PiperTtsClient;

    private _player: PiperAudioPlayer;

    private _closed = false;

    private _draining?: () => void;

    private _queue: IS2SV2Utterance[] = [];

    private _generation = 0;

    private _running = false;

    private _speaking: string | null = null;

    private _speakingMessageId: string | null = null;

    /**
     * Initializes a new {@code S2SV2Speaker} instance.
     *
     * @param {Object} callbacks - What it needs to reach the speech service, and what to tell the rest of the
     * feature about.
     */
    constructor(callbacks: {
        getState: () => IReduxState;
        onError: () => void;
        onSpeakingChange: (speakerId: string | null, messageId: string | null) => void;
    }) {
        this._onError = callbacks.onError;
        this._onSpeakingChange = callbacks.onSpeakingChange;
        this._client = new PiperTtsClient({ getState: callbacks.getState });
        this._player = new PiperAudioPlayer();
    }

    /**
     * Whether anything is waiting to be read out or being read out right now.
     *
     * @returns {boolean}
     */
    get busy(): boolean {
        return this._running || this._queue.length > 0;
    }

    /**
     * Whether this device can read anything out at all. Piper is a server the app carries its own connection to,
     * not something which may or may not be installed on the device, so this is always true.
     *
     * @returns {boolean}
     */
    static get supported(): boolean {
        return true;
    }

    /**
     * Opens the speech connection, so that the first sentence of a session does not wait for it.
     *
     * @returns {void}
     */
    open() {
        this._closed = false;
        this._client.connect();
    }

    /**
     * Returns whether the speech service has a voice for a language.
     *
     * Worth asking before the first sentence rather than finding out during it: the service is not asked what it
     * cannot do, and telling a listener up front is worth more than a session which quietly says nothing in their
     * chosen language.
     *
     * @param {string} language - The language a listener chose.
     * @returns {Promise<boolean>}
     */
    async canSpeak(language: string): Promise<boolean> {
        return this._client.canSpeak(language);
    }

    /**
     * Queues one sentence to be read out.
     *
     * @param {IS2SV2Utterance} utterance - What to say, in which language, and on whose behalf.
     * @returns {void}
     */
    speak(utterance: IS2SV2Utterance) {
        console.log(`[s2s-v2] Speaker: asked to speak ${utterance.messageId} (closed: ${this._closed}, `
            + `queue length before: ${this._queue.length})`);

        if (this._closed || !utterance.text.trim()) {
            return;
        }

        this._queue.push(utterance);

        // Said first, read first. Sorted on the way in rather than searched on the way out, so that the queue stays in
        // a state which can be trimmed from the front.
        this._queue.sort((first, second) => first.timestamp - second.timestamp);

        while (this._queue.length > TTS_QUEUE_LIMIT) {
            const dropped = this._queue.shift();

            logger.warn(`Dropped ${dropped?.messageId} without reading it out: the room is saying more than can be`
                + ' read aloud');
        }

        this._drain();
    }

    /**
     * Answers once everything queued has been read out, so that a session which ends mid-sentence finishes it before
     * the volumes it turned down are given back.
     *
     * @returns {Promise<void>}
     */
    waitUntilIdle(): Promise<void> {
        if (!this.busy) {
            return Promise.resolve();
        }

        return new Promise<void>(resolve => {
            this._draining = resolve;
        });
    }

    /**
     * Stops whatever is being said and drops everything waiting.
     *
     * @returns {void}
     */
    close() {
        this._closed = true;
        this._queue = [];
        this._draining = undefined;

        this._player.stop();
        this._client.disconnect();

        this._setSpeaking(null, null);
    }

    /**
     * Cuts off whatever is playing or being synthesized right now, and drops everything still queued, without
     * closing the connection or resetting the session - the feature is still enabled, it is only listening to a
     * different language from this moment on.
     *
     * Distinct from {@link close}: a session ending drains what is already queued before anything stops, because
     * cutting somebody off mid-sentence to save a moment is a worse listening experience than the extra second it
     * takes to finish. A language change is the opposite - the audio already in flight is in a language nobody is
     * listening in any more, so finishing it plays a sentence to nobody.
     *
     * @returns {void}
     */
    interruptForLanguageChange(): void {
        this._generation++;
        this._queue = [];
        this._player.stop();
    }

    /**
     * Reads the queue out, one sentence at a time, until there is nothing left in it.
     *
     * @returns {Promise<void>}
     */
    private async _drain() {
        if (this._running) {
            return;
        }

        this._running = true;

        while (this._queue.length && !this._closed) {
            const generation = this._generation;
            const utterance = this._queue.shift() as IS2SV2Utterance;

            console.log(`[s2s-v2] Speaker: draining ${utterance.messageId} (${this._queue.length} left after this)`);

            this._setSpeaking(utterance.speakerId, utterance.messageId);

            try {
                // What goes to the service is what the microphone might hear back, so it is remembered before playback
                // starts. The capture stays full duplex; this rejects anything the platform echo canceller leaves behind.
                rememberSpokenText(utterance.text);

                // And the English it was translated from, which is what an echo of it actually comes back as. The
                // microphone hears this sentence in the listener's language; the transcription service is asked for
                // the translate task and answers in English whatever it heard. Remembering only the spoken line leaves
                // the two in different languages and nothing to match, which is to say no backstop at all for every
                // listener who is not listening in English.
                if (utterance.originalText && utterance.originalText !== utterance.text) {
                    rememberSpokenText(utterance.originalText);
                }

                const { bytes, format } = await this._client.synthesize(utterance.text, utterance.language);

                // A language change while that was in flight already cut off whatever was playing and dropped
                // everything queued behind it - this one arrived too late to matter and is not played either, in a
                // language the listener switched away from before it was even ready.
                const interrupted = generation !== this._generation;

                if (!interrupted && !this._closed) {
                    await this._player.play(bytes, format);
                }
            } catch (error) {
                logger.warn(`Could not read ${utterance.messageId} out loud`, error);
                console.warn(`[s2s-v2] Could not read ${utterance.messageId} out loud: `
                    + `${error instanceof Error ? error.message : String(error)}`);

                // Not a failure worth reporting when it is this session closing that cut the sentence off - a
                // listener told the speech connection is unavailable while turning the feature off themselves would
                // be told something which is not true a moment later.
                if (!this._closed) {
                    this._onError();
                }
            } finally {
                this._setSpeaking(null, null);
            }
        }

        this._running = false;

        if (!this.busy && this._draining) {
            const drained = this._draining;

            this._draining = undefined;
            drained();
        }
    }

    /**
     * Records who is being read out and tells whoever is listening.
     *
     * @param {string} speakerId - Who, or nobody.
     * @param {string | null} messageId - Which utterance, or nobody.
     * @returns {void}
     */
    private _setSpeaking(speakerId: string | null, messageId: string | null) {
        if (this._speaking === speakerId && this._speakingMessageId === messageId) {
            return;
        }

        this._speaking = speakerId;
        this._speakingMessageId = messageId;
        this._onSpeakingChange(speakerId, messageId);
    }
}
