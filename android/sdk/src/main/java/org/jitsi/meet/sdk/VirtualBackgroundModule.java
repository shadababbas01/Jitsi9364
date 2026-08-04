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

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

import javax.annotation.Nonnull;

/**
 * Bridge for the real time virtual background feature. It lets the JavaScript side pick the
 * background which {@link VirtualBackgroundProcessor} composites into the local camera stream, and
 * lets the user import an image from the device gallery.
 *
 * The effect itself is switched on by calling {@code MediaStreamTrack._setVideoEffect()} with
 * {@link #PROCESSOR_NAME} from JavaScript; this module only owns the selection.
 */
public class VirtualBackgroundModule extends ReactContextBaseJavaModule {
    /**
     * The name of this module to be used in the React Native bridge.
     */
    private static final String NAME = "JitsiVirtualBackground";

    private static final String TAG = NAME;

    /**
     * Directory, relative to the app's private files directory, where images imported from the
     * gallery are kept. They are copied out of the gallery so that the selection survives both a
     * restart and the revocation of the (single use) grant the photo picker hands out.
     */
    private static final String IMAGES_DIRECTORY = "virtual-backgrounds";

    private static final int PICK_IMAGE_REQUEST_CODE = 4711;

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode != PICK_IMAGE_REQUEST_CODE) {
                return;
            }

            Promise promise = pickImagePromise.getAndSet(null);

            if (promise == null) {
                return;
            }

            Uri uri = resultCode == Activity.RESULT_OK && data != null ? data.getData() : null;

            if (uri == null) {
                // The user dismissed the picker.
                promise.resolve(null);

                return;
            }

            executor.execute(() -> {
                try {
                    WritableMap result = Arguments.createMap();

                    result.putString("uri", importImage(uri));
                    promise.resolve(result);
                } catch (IOException e) {
                    JitsiMeetLogger.e(e, TAG + " could not import the selected image");
                    promise.reject("import-failed", e.getMessage());
                }
            });
        }
    };

    /**
     * Runs the image copying and decoding off the main thread.
     */
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * The promise of the in flight {@link #pickImage} call, if any.
     */
    private final AtomicReference<Promise> pickImagePromise = new AtomicReference<>();

    public VirtualBackgroundModule(ReactApplicationContext reactContext) {
        super(reactContext);

        // Registers the effect with react-native-webrtc so that the JavaScript side can enable it
        // on the local video track.
        VirtualBackgroundController.getInstance();

        reactContext.addActivityEventListener(activityEventListener);
    }

    @Override
    public Map<String, Object> getConstants() {
        Map<String, Object> constants = new HashMap<>();

        constants.put("PROCESSOR_NAME", VirtualBackgroundController.PROCESSOR_NAME);

        return constants;
    }

    @Override
    public @Nonnull String getName() {
        return NAME;
    }

    @Override
    public void invalidate() {
        getReactApplicationContext().removeActivityEventListener(activityEventListener);
        executor.shutdown();

        super.invalidate();
    }

    /**
     * Selects the background composited into the local camera stream.
     *
     * @param options - {@code type} is one of {@code none}, {@code blur} or {@code image};
     * {@code uri} points at the image for the {@code image} type; {@code blurValue} is the blur
     * strength for the {@code blur} type.
     * @param promise - Resolved once the background is ready to be composited.
     */
    @ReactMethod
    public void setBackground(ReadableMap options, Promise promise) {
        String type = options.hasKey("type") ? options.getString("type") : null;

        if (type == null || "none".equals(type)) {
            VirtualBackgroundController.getInstance().clear();
            promise.resolve(null);

            return;
        }

        if ("blur".equals(type)) {
            int blurValue = options.hasKey("blurValue") ? options.getInt("blurValue") : 25;

            VirtualBackgroundController.getInstance().setBlur(blurValue);
            promise.resolve(null);

            return;
        }

        String uri = options.hasKey("uri") ? options.getString("uri") : null;

        if (uri == null) {
            promise.reject("invalid-options", "No image URI was given");

            return;
        }

        // Decoding can take a while for a large picture, so keep it off the main thread and only
        // resolve once the background is actually ready.
        executor.execute(() -> {
            try {
                VirtualBackgroundController
                    .getInstance()
                    .setImage(getReactApplicationContext(), uri);
                promise.resolve(null);
            } catch (IOException e) {
                JitsiMeetLogger.e(e, TAG + " could not load the background image");
                promise.reject("load-failed", e.getMessage());
            }
        });
    }

    /**
     * Opens the system image picker and imports the picked image into the app's private storage.
     *
     * @param promise - Resolved with {@code { uri }}, or with {@code null} if the user dismissed
     * the picker.
     */
    @ReactMethod
    public void pickImage(Promise promise) {
        Activity activity = getCurrentActivity();

        if (activity == null) {
            promise.reject("no-activity", "There is no current Activity");

            return;
        }

        if (!pickImagePromise.compareAndSet(null, promise)) {
            promise.reject("already-picking", "An image is already being picked");

            return;
        }

        try {
            activity.startActivityForResult(createPickImageIntent(), PICK_IMAGE_REQUEST_CODE);
        } catch (Throwable t) {
            pickImagePromise.compareAndSet(promise, null);
            JitsiMeetLogger.e(t, TAG + " could not open the image picker");
            promise.reject("picker-unavailable", t.getMessage());
        }
    }

    /**
     * Deletes a previously imported image.
     *
     * @param uri - The URI which {@link #pickImage} resolved with.
     * @param promise - Resolved once the image is gone.
     */
    @ReactMethod
    public void deleteImage(String uri, Promise promise) {
        executor.execute(() -> {
            File file = toImportedFile(uri);

            if (file != null && file.exists() && !file.delete()) {
                JitsiMeetLogger.w(TAG + " could not delete " + uri);
            }

            promise.resolve(null);
        });
    }

    /**
     * Builds the intent used to pick an image. Android 13 and newer have a dedicated photo picker
     * which needs no storage permission at all; older releases fall back to the documents UI,
     * which also needs none.
     *
     * @return The intent.
     */
    private static Intent createPickImageIntent() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Intent intent = new Intent(MediaStore.ACTION_PICK_IMAGES);

            intent.setType("image/*");

            return intent;
        }

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);

        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");

        return intent;
    }

    /**
     * Copies an image out of the gallery and into the app's private storage.
     *
     * @param uri - The picked image.
     * @return A {@code file:} URI for the imported copy, usable both by React Native's
     * {@code Image} and by the frame processor.
     * @throws IOException If the image cannot be read or written.
     */
    private String importImage(Uri uri) throws IOException {
        File directory = new File(getReactApplicationContext().getFilesDir(), IMAGES_DIRECTORY);

        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create " + directory);
        }

        File file = new File(directory, "background-" + System.currentTimeMillis() + ".jpg");

        try (InputStream in = getReactApplicationContext().getContentResolver().openInputStream(uri)) {
            if (in == null) {
                throw new IOException("Could not read " + uri);
            }

            try (OutputStream out = new FileOutputStream(file)) {
                byte[] buffer = new byte[16384];
                int read;

                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
            }
        }

        return Uri.fromFile(file).toString();
    }

    /**
     * Resolves a URI to a file inside {@link #IMAGES_DIRECTORY}, refusing anything outside of it so
     * that a stale or hostile URI cannot delete unrelated files.
     *
     * @param uri - The URI to resolve.
     * @return The file, or {@code null} if {@code uri} does not name an imported image.
     */
    private File toImportedFile(String uri) {
        if (uri == null) {
            return null;
        }

        String path = Uri.parse(uri).getPath();

        if (path == null) {
            return null;
        }

        File directory = new File(getReactApplicationContext().getFilesDir(), IMAGES_DIRECTORY);
        File file = new File(path);

        return directory.equals(file.getParentFile()) ? file : null;
    }
}
