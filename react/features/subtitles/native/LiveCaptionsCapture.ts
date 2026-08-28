import { DeviceEventEmitter } from 'react-native';

import { IStore } from '../../app/types';
import {
    IMelpUtterance,
    MELP_UTTERANCE_READY_EVENT,
    getLocalMicRecorderNativeModule
} from '../../audio-extraction/functions.native';
import { MEDIA_TYPE } from '../../base/media/constants';
import { getLocalParticipant } from '../../base/participants/functions';
import { findRecentlySpokenMatch } from '../../caption-tts/spokenText';
import { isHallucinatedTranscript } from '../../live-transcribe/hallucinations';
import { transcribeWavOverSocket } from '../../live-transcribe/native/transcribeWav';
import { removeTranscriptBoundaryOverlap } from '../../live-transcribe/transcriptOverlap';
import {
    CAPTIONS_AUDIO_TRACK_GRACE_MS,
    CAPTIONS_ECHO_TAIL_MS,
    CAPTIONS_MAX_UTTERANCE_MS,
    CAPTIONS_MIN_UTTERANCE_MS,
    CAPTIONS_SILENCE_HANGOVER_MS,
    CAPTIONS_TRANSCRIBE_TIMEOUT_MS
} from '../constants';
import { isLiveTranscriptionActive } from '../functions.any';
import logger from '../logger';

/**
 * What the capture tells the rest of the feature about.
 */
interface ICallbacks {

    /**
     * The microphone could not be opened, or there is no audio track to listen to.
     */
    onMicUnavailable: () => void;

    /**
     * An utterance could not be turned into text. Raised once per session rather than once per sentence.
     */
    onTranscribeFailed: () => void;

    /**
     * One finished utterance, in English, ready to be shown here and sent to the meeting.
     */
    onTranscript: (text: string) => void;
}

/**
 * Runs the microphone on every device in a live captions session and turns what it hears into English text.
 *
 * The same stack s2s-v2 captures through, and deliberately so: the native utterance-session recorder, which keeps the
 * microphone open and hands over one file per pause using its own adaptive-noise-floor detector, and the transcription
 * socket, which holds one connection open for the call rather than paying for a handshake every few seconds. Nothing
 * about this goes near the Jigasi transcriber the feature used to ask for.
 *
 * Not gated on the role. A session is started by somebody and then belongs to the room: once it is running, anybody in
 * it may speak and be captioned.
 *
 * The voice activity detection is the recorder's own rather than a threshold applied here: it runs on the capture
 * thread and the contract asks for the behaviour - that nothing but speech reaches the transcription service - rather
 * than for a particular implementation of it. What it cannot do on its own is the second gate: a segment can clear the
 * detector and still transcribe to nothing, so anything which comes back empty is dropped here rather than published.
 */
export default class LiveCaptionsCapture {
    private _callbacks: ICallbacks;

    /**
     * Utterances are transcribed one after another, so that a slow request for something said earlier cannot arrive
     * after a quick one for something said later. Out of order captions are visible to everybody in the meeting.
     */
    private _chain: Promise<void> = Promise.resolve();

    /**
     * Whether a missing audio track has already been given its grace period.
     */
    private _graceTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Whether a caption is being read aloud right now, and the window the last one occupied.
     *
     * Recorded and nothing else. The microphone is never closed for it - somebody has to be able to talk over a
     * caption being read out - so this decides nothing about what is captured, only whether a transcript could
     * possibly be an echo of the loudspeaker.
     */
    private _playing = false;

    private _playingSince = 0;

    private _playedUntil = 0;

    /**
     * When the raised threshold is due to be lowered, held so that playback starting again inside the tail cancels it.
     */
    private _playbackRelease?: ReturnType<typeof setTimeout>;

    /**
     * What the previous chunk came back as, kept only so that the words a forced split repeats can be taken out of the
     * chunk which follows it.
     */
    private _previousText = '';

    private _running = false;

    private _store: IStore;

    private _subscriptions: Array<{ remove: () => void; }> = [];

    /**
     * Initializes a new {@code LiveCaptionsCapture} instance.
     *
     * @param {IStore} store - The redux store.
     * @param {ICallbacks} callbacks - What to tell the rest of the feature about.
     */
    constructor(store: IStore, callbacks: ICallbacks) {
        this._store = store;
        this._callbacks = callbacks;
    }

    /**
     * Starts or stops the microphone to match what the session, the mute state and the audio track currently say.
     *
     * Called whenever any of the three changes rather than only when the session does, because all three have to hold:
     * a session running with the microphone muted captures nothing, and starts capturing the moment it is unmuted
     * without anything else having to notice.
     *
     * @returns {void}
     */
    sync() {
        const state = this._store.getState();
        const active = isLiveTranscriptionActive(state);
        const muted = state['features/base/media'].audio.muted;
        const hasTrack = state['features/base/tracks'].some(track =>
            track.local && track.mediaType === MEDIA_TYPE.AUDIO);

        // A track is attached a moment after the conference is joined. Reporting a microphone problem in that moment
        // would be reporting one which does not exist, so the absence is only believed once it has lasted.
        if (active && !muted && !hasTrack) {
            this._waitForTrack();
        } else if (this._graceTimeout) {
            clearTimeout(this._graceTimeout);
            this._graceTimeout = undefined;
        }

        if (!active || muted || !hasTrack || !getLocalParticipant(state)?.id) {
            this.stop();

            return;
        }

        if (!this._running) {
            this._start();
        }
    }

    /**
     * Notes that a caption has started or finished being read aloud.
     *
     * Named for what it observes rather than for what it does, because it does nothing: the microphone stays open
     * throughout. This only remembers when playback happened, so that the echo check can be asked of the utterances
     * which might be echoes and left off the ones which cannot.
     *
     * @param {boolean} playing - Whether a caption is audible right now.
     * @returns {void}
     */
    setPlaying(playing: boolean) {
        clearTimeout(this._playbackRelease as ReturnType<typeof setTimeout>);
        this._playbackRelease = undefined;

        if (playing !== this._playing) {
            this._playing = playing;

            if (playing) {
                this._playingSince = Date.now();
            } else {
                // The loudspeaker stops before the room does, so the window stays open a little past the end.
                this._playedUntil = Date.now() + CAPTIONS_ECHO_TAIL_MS;
            }
        }

        if (playing) {
            this._setRecorderPlaybackActive(true);

            return;
        }

        this._playbackRelease = setTimeout(() => {
            this._playbackRelease = undefined;
            this._setRecorderPlaybackActive(false);
        }, CAPTIONS_ECHO_TAIL_MS);
    }

    /**
     * Closes the microphone and forgets everything in flight.
     *
     * @returns {void}
     */
    stop() {
        clearTimeout(this._graceTimeout as ReturnType<typeof setTimeout>);
        this._graceTimeout = undefined;

        if (!this._running) {
            return;
        }

        this._running = false;
        this._playing = false;
        this._playingSince = 0;
        this._playedUntil = 0;
        this._previousText = '';
        clearTimeout(this._playbackRelease as ReturnType<typeof setTimeout>);
        this._playbackRelease = undefined;
        this._setRecorderPlaybackActive(false);

        try {
            getLocalMicRecorderNativeModule()?.stopUtteranceSession();
        } catch (error) {
            logger.warn('Could not close the microphone', error);
        }

        this._subscriptions.forEach(subscription => subscription.remove());
        this._subscriptions = [];
    }

    /**
     * Tells the recorder how hard it should be to start an utterance right now.
     *
     * @param {boolean} active - Whether a caption is audible.
     * @returns {void}
     */
    private _setRecorderPlaybackActive(active: boolean) {
        try {
            getLocalMicRecorderNativeModule()?.setUtteranceSessionPlaybackActive?.(active);
        } catch (error) {
            logger.warn('Could not tell the recorder about playback', error);
        }
    }

    /**
     * Returns whether anything was coming out of the loudspeaker while an utterance was being recorded.
     *
     * The recorder reports how long an utterance ran but not when it began, so the start is taken from the length and
     * the moment it was handed over. Close enough for what this decides.
     *
     * @param {IMelpUtterance} utterance - The utterance which was handed over.
     * @returns {boolean}
     */
    private _overlappedPlayback(utterance: IMelpUtterance): boolean {
        const endedAt = Date.now();
        const startedAt = endedAt - (typeof utterance.durationMs === 'number' ? utterance.durationMs : 0);
        const playbackEnd = this._playing ? endedAt : this._playedUntil;

        return playbackEnd >= startedAt && this._playingSince <= endedAt;
    }

    /**
     * Decides, after a moment, that a session which has no local audio track is not going to get one.
     *
     * @returns {void}
     */
    private _waitForTrack() {
        if (this._graceTimeout) {
            return;
        }

        this._graceTimeout = setTimeout(() => {
            this._graceTimeout = undefined;

            const state = this._store.getState();

            if (isLiveTranscriptionActive(state)
                    && !state['features/base/media'].audio.muted
                    && !state['features/base/tracks'].some(track =>
                        track.local && track.mediaType === MEDIA_TYPE.AUDIO)) {
                logger.warn('No local audio track to caption from');
                this._callbacks.onMicUnavailable();
            }
        }, CAPTIONS_AUDIO_TRACK_GRACE_MS);
    }

    /**
     * Opens the microphone and starts listening for utterances.
     *
     * @returns {void}
     */
    private _start() {
        const recorder = getLocalMicRecorderNativeModule();

        // No recorder at all: this device can read a session but cannot speak into one. Said once, here, rather than
        // discovered as a silence which nobody can explain.
        if (!recorder?.startUtteranceSession) {
            logger.warn('This device has no microphone capture, so nothing said on it will be captioned');
            this._callbacks.onMicUnavailable();

            return;
        }

        this._running = true;

        this._subscriptions = [
            DeviceEventEmitter.addListener(MELP_UTTERANCE_READY_EVENT, (utterance: IMelpUtterance) => {
                if (!this._running || !utterance?.path) {
                    return;
                }

                if (typeof utterance.durationMs === 'number' && utterance.durationMs < CAPTIONS_MIN_UTTERANCE_MS) {
                    logger.info(`Dropped an utterance of ${utterance.durationMs}ms: too short to be speech`);

                    return;
                }

                this._chain = this._chain
                    .then(() => this._transcribe(utterance))
                    .catch(() => {
                        // Already reported. The chain has to survive it, or one failed sentence stops every sentence
                        // after it.
                    });
            })
        ];

        recorder.startUtteranceSession(CAPTIONS_SILENCE_HANGOVER_MS, CAPTIONS_MAX_UTTERANCE_MS)
            .catch((error: unknown) => {
                logger.warn('Could not open the microphone for live captions', error);
                this._running = false;
                this._callbacks.onMicUnavailable();
            });
    }

    /**
     * Turns one recorded utterance into English text and hands it over to be shown and sent.
     *
     * @param {IMelpUtterance} utterance - The recorded utterance.
     * @returns {Promise<void>}
     */
    private async _transcribe(utterance: IMelpUtterance) {
        // Asked before the request rather than after it, because by the time the service answers the loudspeaker has
        // usually stopped and the window this utterance was recorded in is no longer the window we are standing in.
        const couldBeEcho = this._overlappedPlayback(utterance);

        if (!isLiveTranscriptionActive(this._store.getState())) {
            logger.info('Dropped an utterance: live captions are no longer on');

            return;
        }

        try {
            // Read per utterance rather than once when the session starts: a token refreshed mid-session has to reach
            // the socket, which reconnects with it rather than going on using the old one's connection.
            const { jwt } = this._store.getState()['features/base/jwt'];
            const heard = (await transcribeWavOverSocket(utterance.path, {
                jwt,
                timeoutMs: CAPTIONS_TRANSCRIBE_TIMEOUT_MS
            }))?.trim();

            // A chunk which opens with the last moment of the one before it - the recorder cut a speaker who had not
            // paused - opens with the same words too. Taken out here rather than left in, because the seam is a
            // decision this device made about where to cut and nobody else in the meeting should have to see it.
            const text = utterance.continuesPrevious
                ? removeTranscriptBoundaryOverlap(this._previousText, heard).trim()
                : heard;

            this._previousText = heard ?? '';

            logger.info(`The transcription socket answered a ${utterance.durationMs}ms utterance`
                + `${heard ? ` with ${heard.length} chars` : ' with nothing'}`);

            // The second silence gate. A segment can clear the detector and still be nothing anybody said - a chair, a
            // door, a breath - and the service answers those with an empty body. Nothing goes on the wire for them.
            if (!text) {
                logger.info(`Dropped a ${utterance.durationMs}ms utterance: the service heard nothing in it`);

                return;
            }

            if (isHallucinatedTranscript(text, utterance.durationMs)) {
                logger.warn(`Dropped a hallucinated transcript from a ${utterance.durationMs}ms utterance: ${text}`);

                return;
            }

            // The echo check is fuzzy - it matches on containment and on word overlap, because transcription of a
            // loudspeaker is imperfect - and a fuzzy match applied to speech which cannot be an echo does nothing but
            // throw away real sentences. So it is asked only of utterances recorded while something was audible.
            if (couldBeEcho) {
                const spokenMatch = findRecentlySpokenMatch(text, true);

                if (spokenMatch) {
                    logger.warn(`Dropped a transcript which repeats what was just read aloud: "${text}" `
                        + `matched "${spokenMatch}"`);

                    return;
                }
            }

            // The session can have ended while the service was thinking about it, in which case this belongs to a
            // session which no longer exists and nobody wants it.
            if (!isLiveTranscriptionActive(this._store.getState())) {
                logger.debug('Dropped a transcript for a session which ended while it was being transcribed');

                return;
            }

            this._callbacks.onTranscript(text);
        } catch (error) {
            logger.warn('Could not turn an utterance into text', error);
            this._callbacks.onTranscribeFailed();
        }
    }
}
