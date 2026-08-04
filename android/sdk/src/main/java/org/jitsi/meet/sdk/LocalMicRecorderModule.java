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
import android.os.SystemClock;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.annotation.Nonnull;

/**
 * Records the local microphone to a WAV file in app storage.
 */
public class LocalMicRecorderModule extends ReactContextBaseJavaModule {
    private static final String NAME = "LocalMicRecorder";
    private static final String TAG = NAME;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    private static final int[] SAMPLE_RATES = new int[] { 48000, 44100, 32000, 16000 };

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean recording = new AtomicBoolean(false);

    private volatile AudioRecord currentAudioRecord;

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

    private AudioRecord createAudioRecord() {
        for (int sampleRate : SAMPLE_RATES) {
            int bufferSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT);

            if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
                continue;
            }

            AudioRecord audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 2
            );

            if (audioRecord.getState() == AudioRecord.STATE_INITIALIZED) {
                return audioRecord;
            }

            audioRecord.release();
        }

        return null;
    }
}
