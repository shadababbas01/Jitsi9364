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

import android.content.Intent;
import android.media.AudioFormat;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.OutputStream;
import java.util.ArrayList;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.annotation.Nonnull;

/**
 * Transcribes the local microphone on the device itself, live, while it is being recorded.
 *
 * <p>The microphone is deliberately <em>not</em> opened here. During a conference WebRTC already holds it, and
 * {@link LocalMicRecorderModule} holds a second capture for the clip being recorded; handing a third claim to the
 * system recognition service (which runs in its own process) would put it in contention with those and one of them
 * would be served silence. Instead the recogniser is pointed at the read end of a pipe through
 * {@link RecognizerIntent#EXTRA_AUDIO_SOURCE} and the recorder feeds the very same PCM it is already writing to the
 * WAV into the write end, via {@link #feedPcm}. One capture, two consumers, no contention.</p>
 *
 * <p>Requires API 33, which is where both {@code EXTRA_AUDIO_SOURCE} and on-device recognition arrived. Below that
 * {@link #isSupported} answers {@code false} and the caller keeps its previous behaviour.</p>
 */
@ReactModule(name = MelpSpeechRecognizerModule.NAME)
public class MelpSpeechRecognizerModule extends ReactContextBaseJavaModule {
    public static final String NAME = "MelpSpeechRecognizer";
    private static final String TAG = NAME;

    private static final String EVENT_PARTIAL = "melpSpeechPartialResult";
    private static final String EVENT_FINAL = "melpSpeechFinalResult";
    private static final String EVENT_ERROR = "melpSpeechError";

    /**
     * The rate the audio is handed over at. On-device recognition models are trained on 16 kHz speech, so whatever the
     * recorder negotiated for itself is resampled to this rather than declared as-is.
     */
    private static final int TARGET_SAMPLE_RATE = 16000;

    /**
     * How many PCM buffers may wait to be written to the pipe. The queue exists so that {@link #feedPcm} never blocks
     * the recorder's read loop: a full pipe must cost recognition accuracy, never recorded audio.
     */
    private static final int MAX_QUEUED_BUFFERS = 64;

    private static final byte[] POISON_PILL = new byte[0];

    /**
     * The running instance, so the recorder can reach {@link #feedPcm} without the two modules being wired together.
     */
    private static volatile MelpSpeechRecognizerModule instance;

    private final AtomicBoolean listening = new AtomicBoolean(false);
    private final BlockingQueue<byte[]> pcmQueue = new ArrayBlockingQueue<>(MAX_QUEUED_BUFFERS);

    private volatile SpeechRecognizer recognizer;
    private volatile OutputStream pipeSink;
    private volatile ParcelFileDescriptor pipeSource;
    private volatile Thread writerThread;

    public MelpSpeechRecognizerModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
        instance = this;
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public void invalidate() {
        teardown();

        if (instance == this) {
            instance = null;
        }

        super.invalidate();
    }

    /**
     * Hands one buffer of freshly captured PCM to the recogniser. A no-op unless a recognition session is running, so
     * the recorder can call it unconditionally.
     *
     * <p>Called from the recorder's capture thread. It only ever touches a bounded queue and drops buffers when that
     * queue is full, so it cannot stall the capture loop no matter how slowly the recogniser drains the pipe.</p>
     *
     * @param buffer The buffer holding the samples.
     * @param length How many bytes of it are valid.
     * @param sampleRate The rate the samples were captured at.
     */
    static void feedPcm(byte[] buffer, int length, int sampleRate) {
        MelpSpeechRecognizerModule module = instance;

        if (module == null || !module.listening.get() || length <= 0) {
            return;
        }

        module.pcmQueue.offer(resampleTo16k(buffer, length, sampleRate));
    }

    @ReactMethod
    public void isSupported(Promise promise) {
        promise.resolve(isSupportedInternal());
    }

    /**
     * Starts a recognition session which transcribes whatever {@link #feedPcm} is given until {@link #stop} is called.
     *
     * @param promise Resolves once the recogniser has been handed the pipe.
     */
    @ReactMethod
    public void start(int windowMs, Promise promise) {
        if (!isSupportedInternal()) {
            promise.reject("speech_unsupported", "On-device speech recognition is not available on this device");

            return;
        }

        if (listening.getAndSet(true)) {
            promise.reject("speech_busy", "A recognition session is already running");

            return;
        }

        // SpeechRecognizer is main-thread only, both to build and to drive.
        UiThreadUtil.runOnUiThread(() -> {
            ParcelFileDescriptor[] pipe = null;

            try {
                pipe = ParcelFileDescriptor.createPipe();

                pcmQueue.clear();
                pipeSink = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1]);
                startWriterThread();

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);

                intent.putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);

                // English, to match what the Melp transcript it stands in for is translated into and what the read
                // aloud voice expects.
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);

                // A pause in the conversation must not end the session: the window is a fixed length and the recogniser
                // is expected to keep transcribing until the recorder closes the pipe. Recognition services are free to
                // ignore these, so an early finish is still handled rather than assumed away.
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, windowMs);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, windowMs);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, windowMs);
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pipe[0]);
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, TARGET_SAMPLE_RATE);
                intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1);

                recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getReactApplicationContext());
                recognizer.setRecognitionListener(new SessionListener());
                recognizer.startListening(intent);

                // The read end is deliberately kept open until teardown. startListening only posts the request, so the
                // descriptor is not duplicated into the recogniser's process until after this returns and closing it
                // here would hand it a dead one. It does not hold up end of stream either: a pipe reports that once
                // the last *write* end closes, which is what stop() does.
                pipeSource = pipe[0];

                promise.resolve(true);
            } catch (Throwable t) {
                closeQuietly(pipe);
                teardown();
                JitsiMeetLogger.e(t, TAG + " could not start on-device recognition");
                promise.reject("speech_start_failed", t.getMessage());
            }
        });
    }

    /**
     * Ends the session. Closing the write end is what tells the recogniser the utterance is over, so the final result
     * arrives shortly after this returns rather than during it.
     *
     * @param promise Resolves once the session has been torn down.
     */
    @ReactMethod
    public void stop(Promise promise) {
        UiThreadUtil.runOnUiThread(() -> {
            teardown();
            promise.resolve(true);
        });
    }

    private boolean isSupportedInternal() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && SpeechRecognizer.isOnDeviceRecognitionAvailable(getReactApplicationContext());
    }

    /**
     * Drains the queue into the pipe off the capture thread, because a pipe whose reader has fallen behind blocks its
     * writer once the kernel buffer fills.
     */
    private void startWriterThread() {
        Thread thread = new Thread(() -> {
            while (true) {
                byte[] chunk;

                try {
                    chunk = pcmQueue.poll(250, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();

                    return;
                }

                if (chunk == POISON_PILL) {
                    return;
                }

                OutputStream sink = pipeSink;

                if (sink == null) {
                    return;
                }

                if (chunk == null) {
                    continue;
                }

                try {
                    sink.write(chunk);
                    sink.flush();
                } catch (Exception e) {
                    // The recogniser closed its end, which is the normal way a session finishes.
                    return;
                }
            }
        }, TAG + "-writer");

        thread.setDaemon(true);
        writerThread = thread;
        thread.start();
    }

    private void teardown() {
        listening.set(false);

        SpeechRecognizer currentRecognizer = recognizer;

        recognizer = null;

        if (currentRecognizer != null) {
            try {
                currentRecognizer.stopListening();
                currentRecognizer.destroy();
            } catch (Exception e) {
                JitsiMeetLogger.w(e, TAG + " failed to release the recogniser");
            }
        }

        pcmQueue.offer(POISON_PILL);

        Thread thread = writerThread;

        writerThread = null;

        if (thread != null) {
            thread.interrupt();
        }

        OutputStream sink = pipeSink;

        pipeSink = null;

        if (sink != null) {
            try {
                sink.close();
            } catch (Exception ignored) {
                // Already closed by the recogniser.
            }
        }

        ParcelFileDescriptor source = pipeSource;

        pipeSource = null;

        if (source != null) {
            try {
                source.close();
            } catch (Exception ignored) {
                // Already closed.
            }
        }

        pcmQueue.clear();
    }

    private void emit(String event, String text) {
        WritableMap payload = Arguments.createMap();

        payload.putString("text", text == null ? "" : text);

        try {
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(event, payload);
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " could not emit " + event);
        }
    }

    private static String firstResult(android.os.Bundle results) {
        if (results == null) {
            return "";
        }

        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

        return matches == null || matches.isEmpty() ? "" : matches.get(0);
    }

    /**
     * Converts captured PCM to the rate the recogniser is told to expect. Output samples average the input samples
     * they span rather than picking the nearest one, which keeps decimation from folding high frequencies back into
     * the band the recogniser listens to.
     *
     * @param buffer The buffer holding 16 bit little endian mono samples.
     * @param length How many bytes of it are valid.
     * @param sampleRate The rate the samples were captured at.
     * @return The same audio at {@link #TARGET_SAMPLE_RATE}.
     */
    private static byte[] resampleTo16k(byte[] buffer, int length, int sampleRate) {
        int inSamples = length / 2;

        if (sampleRate == TARGET_SAMPLE_RATE || inSamples == 0) {
            byte[] copy = new byte[length];

            System.arraycopy(buffer, 0, copy, 0, length);

            return copy;
        }

        int outSamples = (int) ((long) inSamples * TARGET_SAMPLE_RATE / sampleRate);

        if (outSamples <= 0) {
            return new byte[0];
        }

        byte[] out = new byte[outSamples * 2];

        for (int i = 0; i < outSamples; i++) {
            int start = (int) ((long) i * inSamples / outSamples);
            int end = (int) ((long) (i + 1) * inSamples / outSamples);

            if (end <= start) {
                end = start + 1;
            }

            if (end > inSamples) {
                end = inSamples;
            }

            long sum = 0;

            for (int s = start; s < end; s++) {
                sum += (short) ((buffer[(s * 2) + 1] << 8) | (buffer[s * 2] & 0xff));
            }

            short averaged = (short) (sum / (end - start));

            out[i * 2] = (byte) (averaged & 0xff);
            out[(i * 2) + 1] = (byte) ((averaged >> 8) & 0xff);
        }

        return out;
    }

    private static void closeQuietly(ParcelFileDescriptor[] pipe) {
        if (pipe == null) {
            return;
        }

        for (ParcelFileDescriptor descriptor : pipe) {
            if (descriptor != null) {
                try {
                    descriptor.close();
                } catch (Exception ignored) {
                    // Nothing useful to do about a descriptor which will not close.
                }
            }
        }
    }

    /**
     * Turns recogniser callbacks into events for the JavaScript side.
     */
    private class SessionListener implements RecognitionListener {
        @Override
        public void onReadyForSpeech(android.os.Bundle params) {
            // Nothing to report: the caller already knows it started the session.
        }

        @Override
        public void onBeginningOfSpeech() {
        }

        @Override
        public void onRmsChanged(float rmsdB) {
        }

        @Override
        public void onBufferReceived(byte[] buffer) {
        }

        @Override
        public void onEndOfSpeech() {
        }

        @Override
        public void onError(int error) {
            // A window in which nobody spoke is an ordinary outcome, not a failure worth surfacing.
            if (error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT || error == SpeechRecognizer.ERROR_NO_MATCH) {
                emit(EVENT_FINAL, "");

                return;
            }

            JitsiMeetLogger.w(TAG + " on-device recognition failed with error " + error);
            emit(EVENT_ERROR, "Recognition error " + error);
        }

        @Override
        public void onResults(android.os.Bundle results) {
            emit(EVENT_FINAL, firstResult(results));
        }

        @Override
        public void onPartialResults(android.os.Bundle partialResults) {
            String text = firstResult(partialResults);

            if (!text.isEmpty()) {
                emit(EVENT_PARTIAL, text);
            }
        }

        @Override
        public void onEvent(int eventType, android.os.Bundle params) {
        }
    }
}
