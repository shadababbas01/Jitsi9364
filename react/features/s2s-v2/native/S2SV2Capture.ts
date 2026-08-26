import { DeviceEventEmitter } from 'react-native';

import { IStore } from '../../app/types';
import {
    IMelpUtterance,
    MELP_UTTERANCE_READY_EVENT,
    getLocalMicRecorderNativeModule,
    getMelpSpeechRecognizerNativeModule
} from '../../audio-extraction/functions.native';
import { MEDIA_TYPE } from '../../base/media/constants';
import { getLocalParticipant } from '../../base/participants/functions';
import { findRecentlySpokenMatch } from '../../caption-tts/spokenText';
import { isHallucinatedTranscript } from '../../live-transcribe/hallucinations';
import { transcribeWavOverSocket } from '../../live-transcribe/native/transcribeWav';
import { removeTranscriptBoundaryOverlap } from '../../live-transcribe/transcriptOverlap';
import {
    AUDIO_TRACK_GRACE_MS,
    ECHO_TAIL_MS,
    MAX_UTTERANCE_MS,
    MIN_UTTERANCE_MS,
    SILENCE_HANGOVER_MS,
    TRANSCRIBE_TIMEOUT_MS
} from '../constants';
import {
    findEchoOfRecentSpeech,
    getS2SV2SessionId,
    getS2SV2SourceLanguage,
    getS2SV2TranscriptionUrl,
    isS2SV2Active
} from '../functions';
import logger from '../logger';

/**
 * What the capture tells the rest of the feature about.
 */
interface ICallbacks {

    /**
     * The microphone could not be opened, or there is no audio track to listen to. Both end the session on this device:
     * a participant who cannot be transcribed is not in the session, whatever the panel says.
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
 * Runs the microphone on every device in a session and turns what it hears into English text.
 *
 * Not gated on the role. A session is started by a moderator and then belongs to the room: once it is running, anybody
 * may speak and be translated, the moderator included.
 *
 * The voice activity detection is the recorder's own rather than the web client's constants: it is a native detector
 * with an adaptive noise floor which runs on the capture thread and hands over one file per pause, and the contract
 * asks for the behaviour - that nothing but speech reaches the transcription service - rather than for a particular
 * implementation of it. What it cannot do on its own is the second gate: a segment can clear the detector and still
 * transcribe to nothing, so anything which comes back empty is dropped here rather than sent.
 */
export default class S2SV2Capture {
    private _callbacks: ICallbacks;

    /**
     * Utterances are transcribed one after another, so that a slow request for something said earlier cannot arrive
     * after a quick one for something said later. Out of order transcripts are visible to everybody in the meeting.
     */
    private _chain: Promise<void> = Promise.resolve();

    /**
     * Whether a missing audio track has already been given its grace period.
     */
    private _graceTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Whether a translation is coming out of the loudspeaker right now, and the window the last one occupied.
     *
     * Recorded and nothing else. The microphone is deliberately never closed - the whole point of a full duplex session
     * is that somebody can answer without waiting for the previous translation to finish - so this decides nothing
     * about what is captured. What it decides is whether a transcript could possibly be an echo, which is a different
     * question with a much cheaper answer: if nothing was audible while an utterance was being recorded, then whatever
     * came back is somebody talking, and no amount of resembling something said earlier makes it anything else.
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
     * Initializes a new {@code S2SV2Capture} instance.
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
     * a session which is running with the microphone muted captures nothing, and starts capturing the moment it is
     * unmuted without anything else having to notice.
     *
     * @returns {void}
     */
    sync() {
        const state = this._store.getState();
        const active = isS2SV2Active(state);
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

        // All three have to hold. A session with the microphone muted captures nothing, and starts capturing the
        // moment it is unmuted without anything else having to notice.
        if (!active || muted || !hasTrack || !getLocalParticipant(state)?.id) {
            this.stop();

            return;
        }

        if (!this._running) {
            this._start();
        }
    }

    /**
     * Notes that a translation has started or finished coming out of the loudspeaker.
     *
     * Named for what it observes rather than for what it does, because it does nothing: the microphone stays open
     * throughout and every sample still reaches the transcription service. This only remembers when playback happened,
     * so that the echo checks can be asked of the utterances which might be echoes and left off the ones which cannot.
     *
     * @param {boolean} playing - Whether translated audio is audible right now.
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
                this._playedUntil = Date.now() + ECHO_TAIL_MS;
            }
        }

        if (playing) {
            this._setRecorderPlaybackActive(true);

            return;
        }

        // Held for the tail as well, so audio still decaying in the room is not taken for the start of a sentence.
        this._playbackRelease = setTimeout(() => {
            this._playbackRelease = undefined;
            this._setRecorderPlaybackActive(false);
        }, ECHO_TAIL_MS);
    }

    /**
     * Tells the recorder how hard it should be to start an utterance right now.
     *
     * @param {boolean} active - Whether translated audio is audible.
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

            if (isS2SV2Active(state)
                    && !state['features/base/media'].audio.muted
                    && !state['features/base/tracks'].some(track =>
                        track.local && track.mediaType === MEDIA_TYPE.AUDIO)) {
                logger.warn('No local audio track to transcribe from');
                this._callbacks.onMicUnavailable();
            }
        }, AUDIO_TRACK_GRACE_MS);
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

        try {
            getMelpSpeechRecognizerNativeModule()?.stop()
                .catch(error => logger.warn('Could not stop the on-device recogniser', error));
        } catch (error) {
            logger.warn('Could not stop the on-device recogniser', error);
        }

        this._subscriptions.forEach(subscription => subscription.remove());
        this._subscriptions = [];
    }

    /**
     * Opens the microphone and starts listening for utterances.
     *
     * @returns {void}
     */
    private _start() {
        const recorder = getLocalMicRecorderNativeModule();

        // No recorder at all: this device can listen to a session but cannot speak into one. Said once, here, rather
        // than discovered as a silence which nobody can explain.
        if (!recorder?.startUtteranceSession) {
            logger.warn('This device has no microphone capture, so nothing said on it will be translated');
            this._callbacks.onMicUnavailable();

            return;
        }

        this._running = true;

        this._subscriptions = [
            DeviceEventEmitter.addListener(MELP_UTTERANCE_READY_EVENT, (utterance: IMelpUtterance) => {
                if (!utterance?.path) {
                    return;
                }

                if (typeof utterance.durationMs === 'number' && utterance.durationMs < MIN_UTTERANCE_MS) {
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

        try {
            getMelpSpeechRecognizerNativeModule()?.start(MAX_UTTERANCE_MS)
                .catch(error => logger.warn('Could not start the on-device recogniser', error));
        } catch (error) {
            logger.warn('Could not start the on-device recogniser', error);
        }

        recorder.startUtteranceSession(SILENCE_HANGOVER_MS, MAX_UTTERANCE_MS)
            .catch((error: unknown) => {
                logger.warn('Could not open the microphone for the session', error);
                this._running = false;
                try {
                    getMelpSpeechRecognizerNativeModule()?.stop();
                } catch (recognizerError) {
                    logger.warn('Could not stop the on-device recogniser after a mic failure', recognizerError);
                }
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
        const sessionId = getS2SV2SessionId(this._store.getState());

        // Asked before the request rather than after it, because by the time the service answers the loudspeaker has
        // usually stopped and the window this utterance was recorded in is no longer the window we are standing in.
        const couldBeEcho = this._overlappedPlayback(utterance);

        if (!sessionId) {
            logger.info('Dropped an utterance: no session is running any more');

            return;
        }

        try {
            // Read per utterance rather than once when the session starts: a token refreshed mid-session has to
            // reach the socket, which reconnects with it rather than going on using the old one's connection.
            const state = this._store.getState();
            const { jwt } = state['features/base/jwt'];
            const heard = (await transcribeWavOverSocket(utterance.path, {
                baseUrl: getS2SV2TranscriptionUrl(state),
                jwt,
                language: getS2SV2SourceLanguage(state),
                timeoutMs: TRANSCRIBE_TIMEOUT_MS
            }))?.trim();

            // A chunk which opens with the last moment of the one before it - the recorder cut a speaker who had not
            // paused - opens with the same words too. Taken out here rather than left in, because the seam is a
            // decision this device made about where to cut and nobody else in the meeting should have to see it.
            //
            // Recorded before the drops below and after the strip, so that the next chunk is compared against what was
            // actually heard rather than against a sentence which was thrown away.
            const text = utterance.continuesPrevious
                ? removeTranscriptBoundaryOverlap(this._previousText, heard).trim()
                : heard;

            this._previousText = heard ?? '';

            if (utterance.continuesPrevious && heard && heard !== text) {
                logger.info(`Removed ${heard.length - (text?.length ?? 0)} characters repeated across a forced split`);
            }

            logger.info(`The transcription socket answered a ${utterance.durationMs}ms utterance`
                + `${heard ? ` with ${heard.length} chars` : ' with nothing'}`
                + `${utterance.continuesPrevious ? ' (continues a forced split)' : ''}`);
            console.log(`[s2s-v2] stt answer for a ${utterance.durationMs}ms utterance`
                + `${couldBeEcho ? ' (recorded over the loudspeaker)' : ''}: ${text || '(nothing heard)'}`);

            // The second silence gate. A segment can clear the detector and still be nothing anybody said - a chair, a
            // door, a breath - and the service answers those with an empty body. Nothing goes on the wire for them.
            if (!text) {
                logger.info(`Dropped a ${utterance.durationMs}ms utterance: the service heard nothing in it`);
                console.log(`[s2s-v2] the service heard nothing in a ${utterance.durationMs}ms utterance`);

                return;
            }

            if (isHallucinatedTranscript(text, utterance.durationMs)) {
                logger.warn(`Dropped a hallucinated transcript from a ${utterance.durationMs}ms utterance: ${text}`);
                console.log(`[s2s-v2] dropped as a hallucination (${utterance.durationMs}ms): ${text}`);

                return;
            }

            // Both echo checks below are fuzzy - they match on containment and on word overlap, because transcription
            // of a loudspeaker is imperfect - and a fuzzy match applied to speech which cannot be an echo does nothing
            // but throw away real sentences. The commonest thing anybody says in a translated call is a reply to the
            // line which was just read out to them, in words which overlap it heavily, and the memory of what was read
            // out lasts half a minute. So the checks are asked only of utterances which were actually recorded while
            // something was audible; the rest go straight through.
            //
            // Capture itself remains live throughout either way. The platform echo canceller removes playback from the
            // microphone stream, and these are the independent backstop behind it for devices whose cancellation is
            // incomplete - not a reason to stop listening.
            if (couldBeEcho) {
                // Held to the strict measures, because this is speech recorded while the loudspeaker was going and the
                // commonest thing said over a translation is an answer to it, in the words of the line it answers.
                const spokenMatch = findRecentlySpokenMatch(text, true);

                if (spokenMatch) {
                    logger.warn(`Dropped a transcript which repeats what was just read aloud: "${text}" `
                        + `matched "${spokenMatch}"`);
                    console.log(`[s2s-v2] dropped as an echo of what this device read aloud: "${text}" `
                        + `matched "${spokenMatch}"`);

                    return;
                }

                // And the same sentence arriving by the other route: not this device's own reading of it, but the
                // speaker's own voice off the loudspeaker. It is turned down to a murmur rather than silenced while a
                // session runs, which is quiet enough to listen past and not always quiet enough for the microphone to
                // miss. Nothing was read aloud in that case, so the memory of what was spoken has nothing to match, and
                // only what the room actually said can recognise it.
                const roomMatch = findEchoOfRecentSpeech(
                    this._store.getState(),
                    text,
                    getLocalParticipant(this._store.getState())?.id,
                    true);

                if (roomMatch) {
                    logger.warn(`Dropped a transcript which repeats what somebody else just said: "${text}" `
                        + `matched ${roomMatch.speakerName}'s "${roomMatch.originalText}"`);
                    console.log(`[s2s-v2] dropped as an echo of another participant: "${text}" `
                        + `matched ${roomMatch.speakerName}'s "${roomMatch.originalText}"`);

                    return;
                }
            }

            // The session can have ended while the service was thinking about it, in which case this belongs to a
            // session which no longer exists and nobody wants it.
            if (getS2SV2SessionId(this._store.getState()) !== sessionId) {
                logger.debug('Dropped a transcript for a session which ended while it was being transcribed');

                return;
            }

            console.log(`[s2s-v2] broadcasting: ${text}`);
            this._callbacks.onTranscript(text);
        } catch (error) {
            logger.warn('Could not turn an utterance into text', error);
            this._callbacks.onTranscribeFailed();
        }
    }
}
