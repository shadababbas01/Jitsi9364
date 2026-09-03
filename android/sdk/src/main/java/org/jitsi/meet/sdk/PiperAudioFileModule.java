/*
 * Copyright @ 2019-present 8x8, Inc.
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

import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

import java.io.File;
import java.io.FileOutputStream;

import javax.annotation.Nonnull;

/**
 * Writes base64-encoded audio to a temporary file, and cleans those files up again.
 *
 * The Android build of react-native-sound this app ships (com.zmxv.RNSound.RNSoundModule) only knows how to open a
 * bundled resource, an http(s)/asset/file URL, or a real file which already exists on disk - its createMediaPlayer
 * has no case for a "data:" URI at all, so audio decoded from a Piper TTS response has nowhere to go except a file
 * this device wrote itself first.
 */
@ReactModule(name = PiperAudioFileModule.NAME)
public class PiperAudioFileModule extends ReactContextBaseJavaModule {
    public static final String NAME = "PiperAudioFile";

    /**
     * Kept in its own subdirectory of the cache so that {@link #remove} can confirm a path it is asked to delete is
     * one this module could plausibly have written, rather than trusting whatever string a caller passes it.
     */
    private static final String CACHE_SUBDIR = "piper-tts";

    public PiperAudioFileModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Decodes base64 audio and writes it to a fresh file in the app's cache directory.
     *
     * @param base64 - The audio, base64 encoded.
     * @param extension - The file extension to give the file, e.g. "wav" - not trusted for anything beyond naming
     * the file, since playback is decided by the file's own contents, not its name.
     * @param promise - Resolved with the absolute path of the file written; rejected if it could not be.
     */
    @ReactMethod
    public void write(String base64, String extension, Promise promise) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

            if (bytes.length == 0) {
                promise.reject("empty_audio", "Decoded to zero bytes");
                return;
            }

            File dir = new File(getReactApplicationContext().getCacheDir(), CACHE_SUBDIR);

            if (!dir.exists() && !dir.mkdirs()) {
                promise.reject("write_failed", "Could not create the cache directory for synthesized audio");
                return;
            }

            String safeExtension = extension == null || !extension.matches("[a-zA-Z0-9]+") ? "wav" : extension;
            File file = File.createTempFile("piper-", "." + safeExtension, dir);

            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }

            promise.resolve(file.getAbsolutePath());
        } catch (Exception e) {
            promise.reject("write_failed", e.getMessage(), e);
        }
    }

    /**
     * Deletes one file this module wrote, once whatever played it has finished. Never rejects: a file which is
     * already gone, or a path outside the directory this module writes to, is not treated as a failure - only ever
     * as nothing to do.
     *
     * @param path - The absolute path a prior {@link #write} call resolved with.
     * @param promise - Always resolved.
     */
    @ReactMethod
    public void remove(String path, Promise promise) {
        try {
            File file = new File(path);
            File parent = file.getParentFile();

            if (parent != null
                    && CACHE_SUBDIR.equals(parent.getName())
                    && parent.getParentFile() != null
                    && parent.getParentFile().equals(getReactApplicationContext().getCacheDir())) {
                file.delete();
            }
        } catch (Exception ignored) {
            // Best effort - a leftover temp file in the app's own cache is the OS's to reclaim eventually regardless.
        }

        promise.resolve(null);
    }
}
