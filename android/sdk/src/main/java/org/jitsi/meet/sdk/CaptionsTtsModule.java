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

import android.media.AudioAttributes;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import javax.annotation.Nonnull;

/**
 * Module which reads live caption text aloud using the device's own
 * text-to-speech engine.
 *
 * Speech is rendered with {@link AudioAttributes#USAGE_VOICE_COMMUNICATION} so
 * it follows the in-call audio route (earpiece / speaker / Bluetooth) which is
 * owned by {@link AudioModeModule}, instead of being played on the media
 * stream.
 *
 * Every {@link #speak} call resolves its promise once the utterance has been
 * spoken (or has failed), which lets the JavaScript side queue utterances
 * without having to poll the engine for its state.
 */
public class CaptionsTtsModule extends ReactContextBaseJavaModule {
    /**
     * The name of this module to be used in the React Native bridge.
     */
    private static final String NAME = "CaptionsTTS";

    private static final String TAG = NAME;

    /**
     * Error code reported to JavaScript when the engine is unusable.
     */
    private static final String ERROR_UNAVAILABLE = "tts_unavailable";

    /**
     * The engine to speak with, asked for by name rather than taking whatever the manufacturer shipped as the system
     * default. This is the one Google's own apps navigate with, and its voices are what people recognise a spoken
     * direction as sounding like. Not on every device, so {@link #onEngineInit} falls back.
     */
    private static final String PREFERRED_ENGINE = "com.google.android.tts";

    /**
     * Android's TextToSpeech voices do not expose gender directly. These are the
     * stable hints Google puts in voice names when a male voice is available.
     */
    private static final String[] ENGLISH_MALE_VOICE_HINTS = {
        "male",
        "en-us-x-iom",
        "en-us-x-iob",
        "en-us-x-tpd",
        "en-gb-x-gbb",
        "en-gb-x-rjs"
    };

    /**
     * The device text-to-speech engine. Created lazily by {@link #initialize}
     * and kept around until {@link #shutdown} is called, because initializing
     * the engine takes a noticeable amount of time.
     */
    private TextToSpeech tts;

    /**
     * Whether {@link #tts} finished initializing successfully.
     */
    private boolean ttsReady;

    /**
     * Whether {@link #PREFERRED_ENGINE} has already been tried and is not installed on this device, in which case the
     * system default is used for the rest of the session rather than being asked for and refused every time.
     */
    private boolean preferredEngineUnavailable;

    /**
     * The voices {@link #tts} has, read once and kept.
     *
     * Enumerating them is not free, the answer does not change while an engine
     * lives, and it is wanted for every sentence which asks for a voice by
     * name. Dropped along with the engine.
     */
    private volatile List<Voice> voices;

    /**
     * The same voices, by the name {@link #getVoices} reported them under.
     */
    private final Map<String, Voice> voicesByName = new ConcurrentHashMap<>();

    /**
     * Promises of the utterances which are currently being spoken, mapped by
     * utterance ID.
     */
    private final Map<String, Promise> pendingUtterances = new ConcurrentHashMap<>();

    /**
     * Files for utterances which should be synthesized to disk and returned to
     * JavaScript as a WAV path.
     */
    private final Map<String, File> pendingSynthesizedFiles = new ConcurrentHashMap<>();

    /**
     * Promises waiting for {@link #tts} to finish initializing.
     */
    private final Set<Promise> pendingInitializations
        = ConcurrentHashMap.newKeySet();

    private final AtomicLong utteranceCounter = new AtomicLong();

    public CaptionsTtsModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Creates the text-to-speech engine if necessary and resolves once it is
     * ready to speak.
     *
     * @param promise Resolved with {@code true} when the engine is usable.
     */
    @ReactMethod
    public void initialize(Promise promise) {
        synchronized (this) {
            if (ttsReady) {
                promise.resolve(true);

                return;
            }

            pendingInitializations.add(promise);

            if (tts != null) {
                // Initialization is already in progress, the listener below
                // will settle every pending promise.
                return;
            }

            tts = createEngine();
        }
    }

    /**
     * Creates the engine and wires up everything which does not depend on it having initialized yet.
     *
     * {@link #PREFERRED_ENGINE} is asked for unless it has already turned out not to be installed.
     *
     * @return the engine, which is not usable until {@link #onEngineInit} says so.
     */
    private TextToSpeech createEngine() {
        // The voices belong to the engine which reported them, and this is a different one.
        voices = null;
        voicesByName.clear();

        TextToSpeech engine = preferredEngineUnavailable
            ? new TextToSpeech(getReactApplicationContext(), this::onEngineInit)
            : new TextToSpeech(getReactApplicationContext(), this::onEngineInit, PREFERRED_ENGINE);

        engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                // Nothing to do.
            }

            @Override
            public void onDone(String utteranceId) {
                settleUtterance(utteranceId, true);
            }

            @Override
            public void onError(String utteranceId) {
                settleUtterance(utteranceId, false);
            }

            @Override
            public void onError(String utteranceId, int errorCode) {
                settleUtterance(utteranceId, false);
            }

            @Override
            public void onStop(String utteranceId, boolean interrupted) {
                settleUtterance(utteranceId, false);
            }
        });
        engine.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build());

        return engine;
    }

    /**
     * Speaks the given text in whichever voice the engine considers the best one for the language, and resolves once
     * it has been spoken.
     *
     * @param text The text to be spoken.
     * @param language A BCP-47 language tag, such as {@code en-US}.
     * @param rate The speech rate, where {@code 1} is the engine's default.
     * @param promise Resolved with whether the text was spoken in full.
     */
    @ReactMethod
    public void speak(String text, String language, double rate, Promise promise) {
        speakAs(text, language, rate, null, 0, promise);
    }

    /**
     * Speaks the given text in a named voice and resolves once it has been spoken.
     *
     * Which voice a language is read in is otherwise the engine's own choice, and it is the same choice every time, so
     * every participant in a translated call comes out sounding like the same person. Naming the voice is what lets a
     * caller give each speaker one of their own, and {@code pitch} tells two speakers apart when the engine has fewer
     * voices for a language than the room has people talking.
     *
     * A name the engine does not know, or one belonging to a different language, is not an error: the best voice for
     * the language is used instead, exactly as {@link #speak} would have. Refusing to speak because a voice is missing
     * would cost the listener the sentence, which is far worse than hearing it in a voice they heard somebody else in.
     *
     * @param text The text to be spoken.
     * @param language A BCP-47 language tag, such as {@code en-US}.
     * @param rate The speech rate, where {@code 1} is the engine's default.
     * @param voiceName The name of the voice to read it in, as {@link #getVoices} reported it, or {@code null} to
     * leave the choice to the engine.
     * @param pitch The pitch to read it at, where {@code 1} is the engine's default and anything at or below zero
     * means the same.
     * @param promise Resolved with whether the text was spoken in full.
     */
    @ReactMethod
    public void speakAs(String text, String language, double rate, String voiceName, double pitch, Promise promise) {
        TextToSpeech engine = tts;

        if (!ttsReady || engine == null) {
            promise.reject(ERROR_UNAVAILABLE, "Text to speech engine is not ready");

            return;
        }

        if (text == null || text.trim().isEmpty()) {
            promise.resolve(false);

            return;
        }

        if (language != null && !language.isEmpty()) {
            Locale locale = Locale.forLanguageTag(language);

            if (engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                engine.setLanguage(locale);

                if (!applyNamedVoice(engine, voiceName, locale)) {
                    applyBestVoice(engine, locale);
                }
            } else {
                JitsiMeetLogger.w(TAG + " no voice available for " + language);
                promise.resolve(false);

                return;
            }
        }

        engine.setSpeechRate((float) (rate > 0 ? rate : 1));

        // Set on every utterance rather than only on the ones which ask for it, so that a pitch left behind by the
        // speaker before this one cannot follow the next sentence into a feature which never asked for one.
        engine.setPitch((float) (pitch > 0 ? pitch : 1));

        String utteranceId = "melp-caption-" + utteranceCounter.incrementAndGet();

        pendingUtterances.put(utteranceId, promise);

        int result = engine.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId);

        if (result != TextToSpeech.SUCCESS) {
            settleUtterance(utteranceId, false);
        }
    }

    /**
     * Synthesizes the given text to a WAV file and resolves with the file
     * path once generation completes.
     *
     * @param text The text to synthesize.
     * @param language A BCP-47 language tag, such as {@code en-US}.
     * @param rate The speech rate, where {@code 1} is the engine's default.
     * @param fileName The output file name to create under the cache directory.
     * @param promise Resolved with the absolute file path when generation
     * succeeds.
     */
    @ReactMethod
    public void synthesizeToFile(String text, String language, double rate, String fileName, Promise promise) {
        TextToSpeech engine = tts;

        if (!ttsReady || engine == null) {
            promise.reject(ERROR_UNAVAILABLE, "Text to speech engine is not ready");

            return;
        }

        if (text == null || text.trim().isEmpty()) {
            promise.resolve("");

            return;
        }

        if (language != null && !language.isEmpty()) {
            Locale locale = Locale.forLanguageTag(language);

            if (engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                engine.setLanguage(locale);
                applyBestVoice(engine, locale);
            } else {
                JitsiMeetLogger.w(TAG + " no voice available for " + language);
                promise.resolve("");

                return;
            }
        }

        engine.setSpeechRate((float) (rate > 0 ? rate : 1));

        // Whatever the last spoken sentence was pitched at is not this one's business.
        engine.setPitch(1);

        File outputFile = new File(getReactApplicationContext().getCacheDir(), fileName);
        File parentDir = outputFile.getParentFile();

        if (parentDir != null && !parentDir.exists() && !parentDir.mkdirs()) {
            promise.reject(ERROR_UNAVAILABLE, "Unable to create cache directory");

            return;
        }

        if (outputFile.exists() && !outputFile.delete()) {
            promise.reject(ERROR_UNAVAILABLE, "Unable to replace existing audio file");

            return;
        }

        String utteranceId = "melp-caption-file-" + utteranceCounter.incrementAndGet();

        pendingUtterances.put(utteranceId, promise);
        pendingSynthesizedFiles.put(utteranceId, outputFile);

        int result = engine.synthesizeToFile(text, null, outputFile, utteranceId);

        if (result != TextToSpeech.SUCCESS) {
            pendingSynthesizedFiles.remove(utteranceId);
            settleUtterance(utteranceId, false);
        }
    }

    /**
     * Stops any ongoing and queued speech.
     */
    @ReactMethod
    public void stop() {
        TextToSpeech engine = tts;

        if (engine != null) {
            engine.stop();
        }

        // TextToSpeech#stop does not always report the dropped utterances, so
        // settle whatever is left over ourselves.
        for (String utteranceId : pendingUtterances.keySet()) {
            settleUtterance(utteranceId, false);
        }
    }

    /**
     * Checks whether the engine can speak the given language.
     *
     * @param language A BCP-47 language tag, such as {@code en-US}.
     * @param promise Resolved with whether a voice is available.
     */
    @ReactMethod
    public void isLanguageAvailable(String language, Promise promise) {
        TextToSpeech engine = tts;

        if (!ttsReady || engine == null || language == null || language.isEmpty()) {
            promise.resolve(false);

            return;
        }

        promise.resolve(engine.isLanguageAvailable(Locale.forLanguageTag(language))
            >= TextToSpeech.LANG_AVAILABLE);
    }

    /**
     * Returns the BCP-47 language tags the engine has a voice for.
     *
     * @param promise Resolved with an array of language tags.
     */
    @ReactMethod
    public void getAvailableLanguages(Promise promise) {
        TextToSpeech engine = tts;
        WritableArray languages = Arguments.createArray();

        if (ttsReady && engine != null) {
            try {
                for (Locale locale : engine.getAvailableLanguages()) {
                    languages.pushString(locale.toLanguageTag());
                }
            } catch (Exception e) {
                JitsiMeetLogger.w(e, TAG + " failed to list the available languages");
            }
        }

        promise.resolve(languages);
    }

    /**
     * Returns the voices the engine has for a language, so that a caller can hand different speakers different ones.
     *
     * Reported rather than chosen here: which speaker gets which voice is a decision about the conversation, and the
     * engine knows nothing about the conversation. Voices which are advertised but not installed are reported too,
     * flagged as such, because a caller which is spreading speakers across the voices needs to know they exist and
     * cannot be used.
     *
     * @param language A BCP-47 language tag, such as {@code en-US}, or {@code null} for every voice there is.
     * @param promise Resolved with one entry per voice.
     */
    @ReactMethod
    public void getVoices(String language, Promise promise) {
        TextToSpeech engine = tts;
        WritableArray result = Arguments.createArray();

        if (!ttsReady || engine == null) {
            promise.resolve(result);

            return;
        }

        Locale wanted = language == null || language.isEmpty() ? null : Locale.forLanguageTag(language);

        for (Voice voice : listVoices(engine)) {
            Locale voiceLocale = voice.getLocale();

            if (voiceLocale == null || voice.getName() == null) {
                continue;
            }

            if (wanted != null && !wanted.getLanguage().equals(voiceLocale.getLanguage())) {
                continue;
            }

            Set<String> features = voice.getFeatures();
            WritableMap entry = Arguments.createMap();

            entry.putString("name", voice.getName());
            entry.putString("locale", voiceLocale.toLanguageTag());
            entry.putString("country", voiceLocale.getCountry());
            entry.putInt("quality", voice.getQuality());
            entry.putBoolean("networkRequired", voice.isNetworkConnectionRequired());
            entry.putBoolean("notInstalled", features != null
                && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));

            result.pushMap(entry);
        }

        promise.resolve(result);
    }

    /**
     * Releases the text-to-speech engine.
     */
    @ReactMethod
    public void shutdown() {
        TextToSpeech engine;

        synchronized (this) {
            engine = tts;
            tts = null;
            ttsReady = false;
            voices = null;
            voicesByName.clear();
        }

        if (engine != null) {
            engine.stop();
            engine.shutdown();
        }

        for (String utteranceId : pendingUtterances.keySet()) {
            settleUtterance(utteranceId, false);
        }
    }

    @Override
    public void invalidate() {
        shutdown();
        super.invalidate();
    }

    /**
     * Returns the voices the engine has, reading them the first time and keeping them afterwards.
     *
     * Enumerating them is not free, the answer does not change while an engine lives, and it is wanted for every
     * sentence which asks for a voice by name. An engine which will not answer gives an empty list, which every caller
     * treats as the engine choosing the voice itself: the language has been set either way, so there is always a voice.
     *
     * @param engine the engine to ask
     * @return its voices, empty if it would not say
     */
    private List<Voice> listVoices(TextToSpeech engine) {
        List<Voice> known = voices;

        if (known != null) {
            return known;
        }

        List<Voice> read = new ArrayList<>();

        try {
            Set<Voice> engineVoices = engine.getVoices();

            if (engineVoices != null) {
                read.addAll(engineVoices);
            }
        } catch (Exception e) {
            // Not every engine answers this, and the language is already set, so there is a voice either way.
            JitsiMeetLogger.w(TAG + " could not enumerate the voices of the engine", e);
        }

        for (Voice voice : read) {
            String name = voice.getName();

            if (name != null) {
                voicesByName.put(name, voice);
            }
        }

        voices = read;

        return read;
    }

    /**
     * Points the engine at a particular voice, if it has one by that name and it can be used for the language which is
     * about to be spoken.
     *
     * @param engine the engine to point at a voice
     * @param voiceName the name of the wanted voice, or null to leave the choice to the caller's fallback
     * @param locale the language which is about to be spoken
     * @return whether the engine took it, false meaning the caller should choose the voice the ordinary way
     */
    private boolean applyNamedVoice(TextToSpeech engine, String voiceName, Locale locale) {
        if (voiceName == null || voiceName.isEmpty()) {
            return false;
        }

        listVoices(engine);

        Voice voice = voicesByName.get(voiceName);

        if (voice == null) {
            return false;
        }

        Locale voiceLocale = voice.getLocale();

        // A voice held over from the language the listener was listening in a moment ago would read this sentence in
        // that language's accent, or would not read it at all.
        if (voiceLocale == null || !locale.getLanguage().equals(voiceLocale.getLanguage())) {
            return false;
        }

        Set<String> features = voice.getFeatures();

        if (features != null && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) {
            return false;
        }

        return engine.setVoice(voice) == TextToSpeech.SUCCESS;
    }

    /**
     * Points the engine at the best voice it has for a language.
     *
     * {@link TextToSpeech#setLanguage} only settles on a language; which of the several voices an engine has for it
     * gets used is then left to the engine, and the default is rarely the good one. The network voices are the ones a
     * spoken direction is read out in, and they are what this is looking for. Requiring the network costs nothing
     * here: a translated call cannot work offline anyway, since every message has already been through a transcription
     * and a translation service before there is anything to read out.
     *
     * @param engine the engine to point at a voice
     * @param locale the language which is about to be spoken
     */
    private void applyBestVoice(TextToSpeech engine, Locale locale) {
        Voice best = null;

        for (Voice voice : listVoices(engine)) {
            Locale voiceLocale = voice.getLocale();

            if (voiceLocale == null || !locale.getLanguage().equals(voiceLocale.getLanguage())) {
                continue;
            }

            Set<String> features = voice.getFeatures();

            if (features != null
                    && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) {
                continue;
            }

            if (best == null || scoreVoice(voice, locale) > scoreVoice(best, locale)) {
                best = voice;
            }
        }

        if (best != null) {
            engine.setVoice(best);
        }
    }

    /**
     * Says how much a voice is wanted for a language.
     *
     * @param voice the voice being judged
     * @param wanted the language which is about to be spoken
     * @return the higher the better
     */
    private static int scoreVoice(Voice voice, Locale wanted) {
        String country = wanted.getCountry();
        int score = voice.getQuality();
        String language = wanted.getLanguage();

        // A voice which has to be fetched is a synthesized one rather than a recorded one, and it is the reason for
        // choosing a voice at all.
        if (voice.isNetworkConnectionRequired()) {
            score += 1000;
        }

        // Though the country outweighs both: British English read out in an American accent is worse than either
        // read out in a plainer voice.
        if (country != null && !country.isEmpty()
                && country.equalsIgnoreCase(voice.getLocale().getCountry())) {
            score += 5000;
        }

        if ("en".equalsIgnoreCase(language) && looksLikeEnglishMaleVoice(voice)) {
            score += 10000;
        }

        return score;
    }

    /**
     * Best-effort male voice detection for Google's Android TTS engine.
     *
     * Android exposes a voice name but no gender field, so this keeps the normal quality/country scoring and adds a
     * strong preference only when the engine advertises one of Google's known male English identifiers.
     *
     * @param voice the voice being judged
     * @return whether the voice name looks like a male English voice
     */
    private static boolean looksLikeEnglishMaleVoice(Voice voice) {
        String name = voice.getName();

        if (name == null) {
            return false;
        }

        String normalizedName = name.toLowerCase(Locale.US);

        for (String hint : ENGLISH_MALE_VOICE_HINTS) {
            if (normalizedName.contains(hint)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handles the initialization result of {@link #tts}.
     *
     * @param status One of the {@code TextToSpeech.SUCCESS} / {@code ERROR}
     * constants.
     */
    private void onEngineInit(int status) {
        boolean success = status == TextToSpeech.SUCCESS;

        synchronized (this) {
            // The preferred engine is not on every device, and reading a message out in the manufacturer's voice is a
            // great deal better than not reading it out at all.
            if (!success && !preferredEngineUnavailable) {
                JitsiMeetLogger.w(TAG + " " + PREFERRED_ENGINE + " is unavailable, falling back to the default engine");

                preferredEngineUnavailable = true;

                TextToSpeech failed = tts;

                tts = null;

                if (failed != null) {
                    failed.shutdown();
                }

                // The retry settles everything waiting, so nothing is resolved here.
                tts = createEngine();

                return;
            }

            ttsReady = success;

            if (!success) {
                JitsiMeetLogger.w(TAG + " failed to initialize, status " + status);

                TextToSpeech engine = tts;

                tts = null;

                if (engine != null) {
                    engine.shutdown();
                }
            }
        }

        for (Promise promise : pendingInitializations) {
            if (pendingInitializations.remove(promise)) {
                promise.resolve(success);
            }
        }
    }

    /**
     * Resolves the promise associated with an utterance, if it has not been
     * resolved already.
     *
     * @param utteranceId The ID of the utterance.
     * @param spoken Whether the utterance was spoken in full.
     */
    private void settleUtterance(String utteranceId, boolean spoken) {
        Promise promise = pendingUtterances.remove(utteranceId);
        File outputFile = pendingSynthesizedFiles.remove(utteranceId);

        if (promise != null) {
            if (outputFile != null) {
                if (spoken) {
                    promise.resolve(outputFile.getAbsolutePath());
                } else {
                    promise.resolve("");
                }
            } else {
                promise.resolve(spoken);
            }
        }
    }
}
