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
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.File;
import java.util.concurrent.atomic.AtomicReference;

import javax.annotation.Nonnull;

/**
 * Bridges a recorded audio file out to the Melp Android app, which performs the upload,
 * decryption and transcription flow before returning the transcript to Jitsi.
 */
@ReactModule(name = MelpTranscriptionBridgeModule.NAME)
public class MelpTranscriptionBridgeModule extends ReactContextBaseJavaModule {
    public static final String NAME = "MelpAudioTranscriptionBridge";
    private static final String TAG = NAME;
    private static final String TARGET_PACKAGE = "com.melpapp";
    private static final String TARGET_ACTIVITY = "com.melpapp.ui.activity.AudioTranscriptionBridgeActivity";
    private static final String FILE_PROVIDER_SUFFIX = ".melp-audio-fileprovider";
    private static final String EXTRA_AUDIO_URI = "extra_audio_uri";
    private static final String EXTRA_AUDIO_NAME = "extra_audio_name";
    private static final String EXTRA_MESSAGE_ID = "extra_message_id";
    private static final String EXTRA_CONVERSATION_ID = "extra_conversation_id";
    private static final String EXTRA_TRANSCRIPTION = "extra_transcription";
    private static final String EXTRA_FILE_URL = "extra_file_url";
    private static final String EXTRA_RESOLVED_FILE_URL = "extra_resolved_file_url";
    private static final String EXTRA_UPLOAD_REQUEST_PREVIEW = "extra_upload_request_preview";
    private static final String EXTRA_UPLOAD_API_RESPONSE = "extra_upload_api_response";
    private static final String EXTRA_UPLOAD_ENCRYPTED_DATA = "extra_upload_encrypted_data";
    private static final String EXTRA_UPLOAD_DECRYPTION_ERROR = "extra_upload_decryption_error";
    private static final String EXTRA_UPLOAD_DECRYPTED_RESPONSE = "extra_upload_decrypted_response";
    private static final String EXTRA_UPLOAD_DECRYPTED_FILE_URL = "extra_upload_decrypted_file_url";
    private static final String EXTRA_ERROR_MESSAGE = "extra_error_message";
    private static final int REQUEST_CODE = 7931;

    private final AtomicReference<Promise> pendingPromise = new AtomicReference<>();

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode != REQUEST_CODE) {
                return;
            }

            Promise promise = pendingPromise.getAndSet(null);

            if (promise == null) {
                return;
            }

            if (resultCode != Activity.RESULT_OK || data == null) {
                String errorMessage = data != null ? data.getStringExtra(EXTRA_ERROR_MESSAGE) : null;
                promise.reject(
                    "melp_bridge_cancelled",
                    errorMessage != null && !errorMessage.trim().isEmpty()
                        ? errorMessage
                        : "Melp audio bridge did not return a transcript");
                return;
            }

            String transcription = data.getStringExtra(EXTRA_TRANSCRIPTION);

            if (transcription == null || transcription.trim().isEmpty()) {
                String errorMessage = data.getStringExtra(EXTRA_ERROR_MESSAGE);
                promise.reject(
                    "melp_bridge_empty",
                    errorMessage != null && !errorMessage.trim().isEmpty()
                        ? errorMessage
                        : "Melp audio bridge returned no transcript");
                return;
            }

            WritableMap result = Arguments.createMap();
            result.putString("transcription", transcription);
            putIfPresent(result, "fileUrl", data.getStringExtra(EXTRA_FILE_URL));
            putIfPresent(result, "resolvedFileUrl", data.getStringExtra(EXTRA_RESOLVED_FILE_URL));
            putIfPresent(result, "uploadRequestPreview", data.getStringExtra(EXTRA_UPLOAD_REQUEST_PREVIEW));
            putIfPresent(result, "uploadApiResponse", data.getStringExtra(EXTRA_UPLOAD_API_RESPONSE));
            putIfPresent(result, "uploadEncryptedData", data.getStringExtra(EXTRA_UPLOAD_ENCRYPTED_DATA));
            putIfPresent(result, "uploadDecryptionError", data.getStringExtra(EXTRA_UPLOAD_DECRYPTION_ERROR));
            putIfPresent(result, "uploadDecryptedResponse", data.getStringExtra(EXTRA_UPLOAD_DECRYPTED_RESPONSE));
            putIfPresent(result, "uploadDecryptedFileUrl", data.getStringExtra(EXTRA_UPLOAD_DECRYPTED_FILE_URL));
            promise.resolve(result);
        }
    };

    public MelpTranscriptionBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(activityEventListener);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public void invalidate() {
        getReactApplicationContext().removeActivityEventListener(activityEventListener);
        pendingPromise.set(null);
        super.invalidate();
    }

    @ReactMethod
    public void transcribeAudioFile(String audioPath, String messageId, String conversationId, Promise promise) {
        Activity activity = getCurrentActivity();

        if (activity == null) {
            promise.reject("no-activity", "There is no current Activity");
            return;
        }

        if (!pendingPromise.compareAndSet(null, promise)) {
            promise.reject("bridge-busy", "Another audio transcription is already in progress");
            return;
        }

        try {
            File audioFile = toAudioFile(audioPath);

            if (audioFile == null || !audioFile.exists()) {
                pendingPromise.compareAndSet(promise, null);
                promise.reject("invalid-audio", "The recorded audio file does not exist");
                return;
            }

            String authority = getReactApplicationContext().getPackageName() + FILE_PROVIDER_SUFFIX;
            Uri audioUri = FileProvider.getUriForFile(activity, authority, audioFile);

            Intent intent = new Intent();
            intent.setComponent(new ComponentName(TARGET_PACKAGE, TARGET_ACTIVITY));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setDataAndType(audioUri, "audio/wav");
            intent.putExtra(EXTRA_AUDIO_URI, audioUri.toString());
            intent.putExtra(EXTRA_AUDIO_NAME, audioFile.getName());
            if (messageId != null) {
                intent.putExtra(EXTRA_MESSAGE_ID, messageId);
            }
            if (conversationId != null) {
                intent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN) {
                intent.setClipData(ClipData.newRawUri("audio", audioUri));
            }

            activity.grantUriPermission(TARGET_PACKAGE, audioUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivityForResult(intent, REQUEST_CODE);
        } catch (Throwable t) {
            pendingPromise.compareAndSet(promise, null);
            JitsiMeetLogger.e(t, TAG + " could not open the Melp transcription bridge");
            promise.reject("melp_bridge_unavailable", t.getMessage());
        }
    }

    private static File toAudioFile(String audioPath) {
        if (audioPath == null || audioPath.trim().isEmpty()) {
            return null;
        }

        String normalizedPath = audioPath.startsWith("file://") ? audioPath.substring("file://".length()) : audioPath;
        return new File(normalizedPath);
    }

    private static void putIfPresent(WritableMap map, String key, String value) {
        if (value != null && !value.trim().isEmpty()) {
            map.putString(key, value);
        }
    }
}
