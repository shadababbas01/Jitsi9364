/*
 * Copyright @ 2017-present 8x8, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.jitsi.meet.sdk;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.os.SystemClock;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.annotation.Nonnull;

/**
 * Records the local microphone to a WAV file in app storage.
 *
 * Two ways of doing that live here. {@code recordToFile} records one clip of a known length. The utterance session keeps
 * the microphone open instead and cuts the audio up where the speaker pauses, handing each utterance over as its own WAV
 * file: it is what continuous dictation needs, and it cannot be done from JavaScript, which never sees the samples.
 */
public class LocalMicRecorderModule extends ReactContextBaseJavaModule {
    private static final String NAME = "LocalMicRecorder";
    private static final String TAG = NAME;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    private static final int[] SAMPLE_RATES = new int[] { 48000, 44100, 32000, 16000 };

    /**
     * Emitted with {@code path}, {@code index} and {@code durationMs} once an utterance has been written to disk.
     */
    private static final String EVENT_UTTERANCE = "melpUtteranceReady";

    /**
     * Emitted with {@code speaking} whenever the session starts or stops hearing speech, so the UI can follow the voice
     * rather than guess at it.
     */
    private static final String EVENT_SPEECH_STATE = "melpUtteranceSpeechState";

    /**
     * How much audio from before speech was detected is kept, so that an utterance does not lose its first consonant.
     */
    private static final int PRE_ROLL_MS = 300;

    /**
     * Utterances shorter than this are dropped: a cough or a door is not worth a transcription request.
     */
    private static final int MIN_UTTERANCE_MS = 400;

    /**
     * The quietest signal treated as speech, whatever the room sounds like. Out of a 32768 full scale, so about -36 dB.
     */
    private static final double MIN_SPEECH_RMS = 500;

    /**
     * How far above the measured noise floor a buffer has to be to count as speech.
     */
    private static final double NOISE_FLOOR_MARGIN = 2.5;

    /**
     * How quickly the measured noise floor follows the room. Only updated while nobody is speaking.
     */
    private static final double NOISE_FLOOR_SMOOTHING = 0.05;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * The session holds its thread for as long as it listens, so it cannot share the one clips are recorded on.
     */
    private final ExecutorService sessionExecutor = Executors.newSingleThreadExecutor();

    private final AtomicBoolean recording = new AtomicBoolean(false);
    private final AtomicBoolean sessionRunning = new AtomicBoolean(false);

    /**
     * Whether the running session is ignoring what it hears. Used to deafen it while the device is speaking, so that the
     * text-to-speech voice cannot be recorded back in and transcribed as if somebody had said it.
     */
    private final AtomicBoolean sessionMuted = new AtomicBoolean(false);

    private volatile AudioRecord currentAudioRecord;

    private volatile AudioRecord sessionAudioRecord;

    private volatile AcousticEchoCanceler echoCanceler;

    private volatile NoiseSuppressor noiseSuppressor;

    public LocalMicRecorderModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void recordToFile(String fileName, int durationMs, Promise promise) {
        if (recording.getAndSet(true)) {
            promise.reject("recorder_busy", "Recording is already in progress");

            return;
        }

        executor.execute(() -> {
            FileOutputStream outputStream = null;
            AudioRecord audioRecord = null;

            try {
                ReactApplicationContext context = getReactApplicationContext();
                File outputFile = new File(context.getCacheDir(), fileName);
                File parentDir = outputFile.getParentFile();

                if (parentDir != null && !parentDir.exists() && !parentDir.mkdirs()) {
                    promise.reject("recorder_error", "Unable to create cache directory");

                    return;
                }

                if (outputFile.exists() && !outputFile.delete()) {
                    promise.reject("recorder_error", "Unable to replace existing recording");

                    return;
                }

                audioRecord = createAudioRecord();

                if (audioRecord == null) {
                    promise.reject("recorder_unavailable", "Unable to initialize microphone recorder");

                    return;
                }

                currentAudioRecord = audioRecord;
                audioRecord.startRecording();

                ByteArrayOutputStream pcm = new ByteArrayOutputStream();
                byte[] buffer = new byte[Math.max(4096, AudioRecord.getMinBufferSize(
                    audioRecord.getSampleRate(),
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT))];

                long endAt = SystemClock.elapsedRealtime() + Math.max(1, durationMs);

                while (recording.get() && SystemClock.elapsedRealtime() < endAt) {
                    int read = audioRecord.read(buffer, 0, buffer.length);

                    if (read > 0) {
                        pcm.write(buffer, 0, read);

                        // The same samples feed the live on-device transcription, so that it never has to open a
                        // microphone of its own and contend with this capture or with the conference's.
                        MelpSpeechRecognizerModule.feedPcm(buffer, read, audioRecord.getSampleRate());
                    }
                }

                byte[] wav = AudioChunkEncoder.toWav(
                    pcm.toByteArray(),
                    pcm.size(),
                    audioRecord.getSampleRate(),
                    1
                );

                outputStream = new FileOutputStream(outputFile);
                outputStream.write(wav);
                outputStream.flush();

                promise.resolve(outputFile.getAbsolutePath());
            } catch (Exception e) {
                JitsiMeetLogger.w(e, TAG + " failed to record microphone audio");
                promise.reject("recorder_error", "Failed to record microphone audio", e);
            } finally {
                recording.set(false);
                currentAudioRecord = null;
                releaseEchoCancellation();

                if (audioRecord != null) {
                    try {
                        audioRecord.stop();
                    } catch (Exception ignored) {
                        // Ignore stop failures when the recorder is already stopped.
                    }
                    audioRecord.release();
                }

                if (outputStream != null) {
                    try {
                        outputStream.close();
                    } catch (Exception ignored) {
                        // Ignore close failures.
                    }
                }
            }
        });
    }

    @ReactMethod
    public void stop() {
        recording.set(false);

        AudioRecord audioRecord = currentAudioRecord;

        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (Exception ignored) {
                // Recorder might already be stopped.
            }
        }
    }

    /**
     * Keeps the microphone open and hands over one WAV file per utterance, splitting the audio wherever the speaker
     * pauses for {@code silenceMs}. Each utterance arrives as an {@code melpUtteranceReady} event; speech starting and
     * stopping arrives as {@code melpUtteranceSpeechState}.
     *
     * @param silenceMs how long a pause ends an utterance
     * @param maxUtteranceMs the longest utterance handed over without a pause, so a monologue is still transcribed
     * @param promise resolved once the microphone is open
     */
    @ReactMethod
    public void startUtteranceSession(int silenceMs, int maxUtteranceMs, Promise promise) {
        if (sessionRunning.getAndSet(true)) {
            // Already listening: the caller gets the session it asked for.
            promise.resolve(true);

            return;
        }

        final int silence = Math.max(200, silenceMs);
        final int maxUtterance = Math.max(1000, maxUtteranceMs);

        sessionExecutor.execute(() -> {
            AudioRecord audioRecord = null;

            try {
                audioRecord = createAudioRecord();

                if (audioRecord == null) {
                    sessionRunning.set(false);
                    promise.reject("recorder_unavailable", "Unable to initialize microphone recorder");

                    return;
                }

                sessionAudioRecord = audioRecord;
                audioRecord.startRecording();
                promise.resolve(true);

                runUtteranceSession(audioRecord, silence, maxUtterance);
            } catch (Exception e) {
                JitsiMeetLogger.w(e, TAG + " utterance session failed");

                try {
                    promise.reject("recorder_error", "Failed to record microphone audio", e);
                } catch (Exception ignored) {
                    // The promise was already settled when the session was under way.
                }
            } finally {
                sessionRunning.set(false);
                sessionMuted.set(false);
                sessionAudioRecord = null;
                releaseEchoCancellation();

                if (audioRecord != null) {
                    try {
                        audioRecord.stop();
                    } catch (Exception ignored) {
                        // Already stopped.
                    }
                    audioRecord.release();
                }

                emitSpeechState(false);
            }
        });
    }

    /**
     * Deafens or un-deafens the running session without closing the microphone.
     *
     * Called while the device reads a message aloud: what comes out of the loudspeaker would otherwise be heard as
     * speech, transcribed, and sent back as a message, which the other side would then read aloud in turn. Anything
     * part-heard when the session is deafened is thrown away rather than handed over, since its tail is the device's own
     * voice.
     *
     * @param muted whether to ignore what the microphone hears
     */
    @ReactMethod
    public void setUtteranceSessionMuted(boolean muted) {
        sessionMuted.set(muted);
    }

    /**
     * Closes the utterance session. Whatever was being said when this is called is still handed over, so that stopping
     * mid-sentence does not lose the sentence.
     */
    @ReactMethod
    public void stopUtteranceSession() {
        sessionRunning.set(false);

        AudioRecord audioRecord = sessionAudioRecord;

        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (Exception ignored) {
                // Already stopped.
            }
        }
    }

    /**
     * Reads the microphone until the session is stopped, cutting the audio into utterances.
     *
     * @param audioRecord the open recorder
     * @param silenceMs how long a pause ends an utterance
     * @param maxUtteranceMs the longest utterance handed over without a pause
     */
    private void runUtteranceSession(AudioRecord audioRecord, int silenceMs, int maxUtteranceMs) {
        int sampleRate = audioRecord.getSampleRate();
        int bufferSize = Math.max(4096, AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT));
        byte[] buffer = new byte[bufferSize];

        // 16 bit mono, so two bytes carry one sample.
        int bytesPerMs = Math.max(1, (sampleRate * 2) / 1000);
        int preRollBytes = PRE_ROLL_MS * bytesPerMs;
        int minUtteranceBytes = MIN_UTTERANCE_MS * bytesPerMs;
        int maxUtteranceBytes = maxUtteranceMs * bytesPerMs;

        ByteArrayOutputStream utterance = new ByteArrayOutputStream();
        ArrayDeque<byte[]> preRoll = new ArrayDeque<>();
        int preRollHeld = 0;
        boolean inSpeech = false;
        int silentBytes = 0;
        int index = 0;
        double noiseFloor = -1;

        while (sessionRunning.get()) {
            int read = audioRecord.read(buffer, 0, buffer.length);

            if (read <= 0) {
                continue;
            }

            if (sessionMuted.get()) {
                // The device is speaking. Everything heard now is thrown away, including anything already collected:
                // its tail would be the device's own voice.
                if (inSpeech) {
                    utterance.reset();
                    inSpeech = false;
                    silentBytes = 0;
                    emitSpeechState(false);
                }

                preRoll.clear();
                preRollHeld = 0;

                continue;
            }

            double rms = rootMeanSquare(buffer, read);

            if (noiseFloor < 0) {
                noiseFloor = rms;
            }

            double threshold = Math.max(MIN_SPEECH_RMS, noiseFloor * NOISE_FLOOR_MARGIN);
            boolean voiced = rms > threshold;

            if (voiced) {
                if (!inSpeech) {
                    inSpeech = true;
                    silentBytes = 0;

                    // The pause before the speech is what makes the first word intelligible.
                    for (byte[] held : preRoll) {
                        utterance.write(held, 0, held.length);
                    }

                    preRoll.clear();
                    preRollHeld = 0;
                    emitSpeechState(true);
                }

                silentBytes = 0;
                utterance.write(buffer, 0, read);
            } else if (inSpeech) {
                // The tail of a sentence trails off, so the quiet part belongs to the utterance too.
                utterance.write(buffer, 0, read);
                silentBytes += read;
            } else {
                // Only the room is being measured, so this is the noise floor.
                noiseFloor = ((1 - NOISE_FLOOR_SMOOTHING) * noiseFloor) + (NOISE_FLOOR_SMOOTHING * rms);

                byte[] held = new byte[read];

                System.arraycopy(buffer, 0, held, 0, read);
                preRoll.addLast(held);
                preRollHeld += read;

                while (preRollHeld > preRollBytes && !preRoll.isEmpty()) {
                    preRollHeld -= preRoll.removeFirst().length;
                }
            }

            boolean pauseEnded = inSpeech && silentBytes >= silenceMs * bytesPerMs;
            boolean tooLong = inSpeech && utterance.size() >= maxUtteranceBytes;

            if (pauseEnded || tooLong) {
                index = finishUtterance(utterance, sampleRate, minUtteranceBytes, index);
                inSpeech = false;
                silentBytes = 0;
                emitSpeechState(false);
            }
        }

        // Stopping mid-sentence still hands the sentence over.
        if (inSpeech) {
            finishUtterance(utterance, sampleRate, minUtteranceBytes, index);
        }
    }

    /**
     * Writes what was said to a WAV file and announces it.
     *
     * @param utterance the samples of the utterance, reset by this method
     * @param sampleRate the rate the samples were recorded at
     * @param minUtteranceBytes below this the utterance is dropped as noise
     * @param index which utterance this is within the session
     * @return the index the next utterance gets
     */
    private int finishUtterance(
            ByteArrayOutputStream utterance,
            int sampleRate,
            int minUtteranceBytes,
            int index) {
        byte[] pcm = utterance.toByteArray();

        utterance.reset();

        if (pcm.length < minUtteranceBytes) {
            return index;
        }

        FileOutputStream outputStream = null;

        try {
            File outputFile = new File(
                getReactApplicationContext().getCacheDir(),
                "melp-utterance-" + System.currentTimeMillis() + "-" + index + ".wav");

            byte[] wav = AudioChunkEncoder.toWav(pcm, pcm.length, sampleRate, 1);

            outputStream = new FileOutputStream(outputFile);
            outputStream.write(wav);
            outputStream.flush();

            WritableMap payload = Arguments.createMap();

            payload.putString("path", outputFile.getAbsolutePath());
            payload.putInt("index", index);
            payload.putInt("durationMs", pcm.length / Math.max(1, (sampleRate * 2) / 1000));
            emit(EVENT_UTTERANCE, payload);

            return index + 1;
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " failed to write an utterance");

            return index;
        } finally {
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (Exception ignored) {
                    // Ignore close failures.
                }
            }
        }
    }

    /**
     * Returns the level of a buffer of 16 bit little endian samples, on the same 32768 full scale as the samples.
     *
     * @param buffer the samples
     * @param length how many bytes of the buffer hold samples
     * @return the root mean square of the samples
     */
    private static double rootMeanSquare(byte[] buffer, int length) {
        long sum = 0;
        int samples = length / 2;

        for (int i = 0; i + 1 < length; i += 2) {
            int sample = (short) ((buffer[i] & 0xff) | (buffer[i + 1] << 8));

            sum += (long) sample * sample;
        }

        return samples == 0 ? 0 : Math.sqrt((double) sum / samples);
    }

    private void emitSpeechState(boolean speaking) {
        WritableMap payload = Arguments.createMap();

        payload.putBoolean("speaking", speaking);
        emit(EVENT_SPEECH_STATE, payload);
    }

    private void emit(String event, WritableMap payload) {
        try {
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(event, payload);
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " could not emit " + event);
        }
    }

    private AudioRecord createAudioRecord() {
        // VOICE_COMMUNICATION first: it is the only source Android applies its echo canceller, noise suppressor and gain
        // control to, which is what keeps the text-to-speech voice coming out of the loudspeaker from being recorded back
        // in and transcribed as if it had been spoken. Not every device offers it, hence the fall back to a raw
        // microphone, where the software gate in the caller has to carry that on its own.
        for (int source : new int[] { MediaRecorder.AudioSource.VOICE_COMMUNICATION, MediaRecorder.AudioSource.MIC }) {
            for (int sampleRate : SAMPLE_RATES) {
                int bufferSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT);

                if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
                    continue;
                }

                AudioRecord audioRecord;

                try {
                    audioRecord = new AudioRecord(
                        source,
                        sampleRate,
                        CHANNEL_CONFIG,
                        AUDIO_FORMAT,
                        bufferSize * 2
                    );
                } catch (Exception e) {
                    JitsiMeetLogger.w(e, TAG + " could not open audio source " + source);

                    continue;
                }

                if (audioRecord.getState() == AudioRecord.STATE_INITIALIZED) {
                    if (source == MediaRecorder.AudioSource.VOICE_COMMUNICATION) {
                        attachEchoCancellation(audioRecord.getAudioSessionId());
                    }

                    return audioRecord;
                }

                audioRecord.release();
            }
        }

        return null;
    }

    /**
     * Turns the platform echo canceller and noise suppressor on for a recording session, where the device has them.
     *
     * The effects are held on to for as long as the session lasts, since releasing them switches them back off, and are
     * dropped in {@link #releaseEchoCancellation()}.
     *
     * @param sessionId the audio session of the recorder they apply to
     */
    private void attachEchoCancellation(int sessionId) {
        releaseEchoCancellation();

        try {
            if (AcousticEchoCanceler.isAvailable()) {
                AcousticEchoCanceler canceler = AcousticEchoCanceler.create(sessionId);

                if (canceler != null) {
                    canceler.setEnabled(true);
                    echoCanceler = canceler;
                }
            }
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " could not enable the echo canceller");
        }

        try {
            if (NoiseSuppressor.isAvailable()) {
                NoiseSuppressor suppressor = NoiseSuppressor.create(sessionId);

                if (suppressor != null) {
                    suppressor.setEnabled(true);
                    noiseSuppressor = suppressor;
                }
            }
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " could not enable the noise suppressor");
        }
    }

    /**
     * Drops the platform audio effects, if any were attached.
     */
    private void releaseEchoCancellation() {
        AcousticEchoCanceler canceler = echoCanceler;

        echoCanceler = null;

        if (canceler != null) {
            try {
                canceler.release();
            } catch (Exception ignored) {
                // Already gone.
            }
        }

        NoiseSuppressor suppressor = noiseSuppressor;

        noiseSuppressor = null;

        if (suppressor != null) {
            try {
                suppressor.release();
            } catch (Exception ignored) {
                // Already gone.
            }
        }
    }
}
