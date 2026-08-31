import { DEFAULT_SPEECH_RATE } from '../../caption-tts/constants';
import { getCaptionsTtsNativeModule, toTtsLanguageTag } from '../../caption-tts/functions.native';
import { rememberSpokenText } from '../../caption-tts/spokenText';
import { TTS_QUEUE_LIMIT } from '../constants';
import logger from '../logger';

import { noteVoiceFailed, resetVoiceAssignments, resolveVoiceForSpeaker } from './voiceAssignment';

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
 * The device speech engine does the speaking, through the same bridge the captions and the 1:1 translated call already
 * read through. Deliberately not a second connection to the speech service: this path is the one which works on the
 * devices this ships to, and translated speech is local to the listener anyway - nothing about which engine says the
 * words crosses the wire, so nothing about it can disagree with the web client.
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
     * Told when the engine cannot speak, so that a listener is not left waiting for audio which is not coming.
     */
    private _onError: () => void;

    private _closed = false;

    private _draining?: () => void;

    private _initialized = false;


    private _queue: IS2SV2Utterance[] = [];

    private _running = false;

    private _speaking: string | null = null;

    private _speakingMessageId: string | null = null;

    /**
     * Initializes a new {@code S2SV2Speaker} instance.
     *
     * @param {Object} callbacks - What to tell the rest of the feature about.
     */
    constructor(callbacks: {
        onError: () => void;
        onSpeakingChange: (speakerId: string | null, messageId: string | null) => void;
    }) {
        this._onError = callbacks.onError;
        this._onSpeakingChange = callbacks.onSpeakingChange;
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
     * Whether this device can read anything out at all.
     *
     * @returns {boolean}
     */
    static get supported(): boolean {
        return Boolean(getCaptionsTtsNativeModule()?.speak);
    }

    /**
     * Wakes the engine up, so that the first sentence of a session does not wait for it.
     *
     * @returns {void}
     */
    open() {
        this._closed = false;
        this._initialize();
    }

    /**
     * Returns whether the device has a voice for a language.
     *
     * Worth asking before the first sentence rather than finding out during it: the engine does not refuse a language
     * it has no voice for, it simply says nothing, which a listener cannot tell apart from nobody talking.
     *
     * @param {string} language - The language a listener chose.
     * @returns {Promise<boolean>}
     */
    async canSpeak(language: string): Promise<boolean> {
        const module = getCaptionsTtsNativeModule();

        if (!module || !await this._initialize()) {
            return false;
        }

        try {
            return await module.isLanguageAvailable(toTtsLanguageTag(language));
        } catch (error) {
            logger.warn('Could not ask the speech engine which languages it has', error);

            return false;
        }
    }

    /**
     * Queues one sentence to be read out.
     *
     * @param {IS2SV2Utterance} utterance - What to say, in which language, and on whose behalf.
     * @returns {void}
     */
    speak(utterance: IS2SV2Utterance) {
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

        // Who sounded like what belonged to that session. The next one starts over, because the participant IDs it
        // hands voices out by will not be the same ones.
        resetVoiceAssignments();

        try {
            getCaptionsTtsNativeModule()?.stop();
        } catch (error) {
            logger.warn('Could not stop the speech engine', error);
        }

        this._setSpeaking(null, null);
    }

    /**
     * Creates the engine, reusing the answer once it is known.
     *
     * @returns {Promise<boolean>} Whether it can be used.
     */
    private async _initialize(): Promise<boolean> {
        if (this._initialized) {
            return true;
        }

        const module = getCaptionsTtsNativeModule();

        if (!module) {
            return false;
        }

        try {
            this._initialized = await module.initialize();
        } catch (error) {
            logger.warn('Could not start the speech engine', error);
            this._initialized = false;
        }

        return this._initialized;
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

        const module = getCaptionsTtsNativeModule();

        if (!module || !await this._initialize()) {
            logger.warn('This device cannot read translations out loud');
            this._queue = [];
            this._running = false;
            this._onError();

            return;
        }

        while (this._queue.length && !this._closed) {
            const utterance = this._queue.shift() as IS2SV2Utterance;

            this._setSpeaking(utterance.speakerId, utterance.messageId);

            try {
                // What goes to the engine is what the microphone might hear back, so it is remembered before playback
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

                const languageTag = toTtsLanguageTag(utterance.language);

                // Whoever is being read out keeps one voice for the whole session, so that a listener can tell who is
                // talking from the sound of it rather than only from the name above the line. Which voice it comes to
                // is worked out in {@link ./voiceAssignment}; an older SDK has no way to be told, and reads everybody
                // out in the one voice it always did.
                const voice = await resolveVoiceForSpeaker(utterance.speakerId, languageTag);
                const spoken = module.speakAs
                    ? await module.speakAs(
                        utterance.text, languageTag, DEFAULT_SPEECH_RATE, voice.name ?? null, voice.pitch)
                    : await module.speak(utterance.text, languageTag, DEFAULT_SPEECH_RATE);

                if (!spoken && voice.name) {
                    // A voice which has to be fetched can fail to say anything at all, which a listener cannot tell
                    // from nobody talking. Counted rather than acted on, see VOICE_FAILURE_LIMIT.
                    noteVoiceFailed(voice.name);
                }
            } catch (error) {
                logger.warn(`Could not read ${utterance.messageId} out loud`, error);
                this._onError();
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
