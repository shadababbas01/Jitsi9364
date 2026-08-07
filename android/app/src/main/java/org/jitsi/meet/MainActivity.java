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

package org.jitsi.meet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.RestrictionEntry;
import android.content.RestrictionsManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;
import android.os.Handler;

import androidx.annotation.Nullable;

import com.oney.WebRTCModule.WebRTCModuleOptions;

import org.jitsi.meet.sdk.JitsiMeet;
import org.jitsi.meet.sdk.JitsiMeetActivity;
import org.jitsi.meet.sdk.JitsiMeetConferenceOptions;
import org.webrtc.Logging;

import java.lang.reflect.Method;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;

/**
 * The one and only Activity that the Jitsi Meet app needs. The
 * {@code Activity} is launched in {@code singleTask} mode, so it will be
 * created upon application initialization and there will be a single instance
 * of it. Further attempts at launching the application once it was already
 * launched will result in {@link MainActivity#onNewIntent(Intent)} being called.
 */
public class MainActivity extends JitsiMeetActivity {
    /**
     * True when the current finish was triggered by the SDK's ready-to-close flow
     * and the task should be removed from Android Recents.
     */
    private boolean removeTaskOnFinish;
    /**
     * The request code identifying requests for the permission to draw on top
     * of other apps. The value must be 16-bit and is arbitrarily chosen here.
     */
    private static final int OVERLAY_PERMISSION_REQUEST_CODE
        = (int) (Math.random() * Short.MAX_VALUE);

    /**
     * ServerURL configuration key for restriction configuration using {@link android.content.RestrictionsManager}
     */
    public static final String RESTRICTION_SERVER_URL = "SERVER_URL";

    /**
     * Broadcast receiver for restrictions handling
     */
    private BroadcastReceiver broadcastReceiver;

    /**
     * Flag if configuration is provided by RestrictionManager
     */
    private boolean configurationByRestrictions = false;

    /**
     * Default URL as could be obtained from RestrictionManager
     */
    private String defaultURL;

    // JitsiMeetActivity overrides
    //

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        JitsiMeet.showSplashScreen(this);

        WebRTCModuleOptions options = WebRTCModuleOptions.getInstance();
        options.loggingSeverity = Logging.Severity.LS_ERROR;

        super.onCreate(null);
    }

    @Override
    protected boolean extraInitialize() {
        Log.d(this.getClass().getSimpleName(), "LIBRE_BUILD="+BuildConfig.LIBRE_BUILD);

        // Setup Crashlytics and Firebase Dynamic Links
        // Here we are using reflection since it may have been disabled at compile time.
        try {
            Class<?> cls = Class.forName("org.jitsi.meet.GoogleServicesHelper");
            Method m = cls.getMethod("initialize", JitsiMeetActivity.class);
            m.invoke(null, this);
        } catch (Exception e) {
            // Ignore any error, the module is not compiled when LIBRE_BUILD is enabled.
        }

        // In Debug builds React needs permission to write over other apps in
        // order to display the warning and error overlays.
        if (BuildConfig.DEBUG) {
            if (!Settings.canDrawOverlays(this)) {
                Intent intent
                    = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));

                startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE);

                return true;
            }
        }

        return false;
    }

    @Override
    protected void initialize() {
        broadcastReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                // As new restrictions including server URL are received,
                // conference should be restarted with new configuration.
                leave();
                recreate();
            }
        };
        registerReceiver(broadcastReceiver,
            new IntentFilter(Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED));

        resolveRestrictions();
        setJitsiMeetConferenceDefaultOptions();
        super.initialize();
    }

    @Override
    public void onDestroy() {
        if (broadcastReceiver != null) {
            unregisterReceiver(broadcastReceiver);
            broadcastReceiver = null;
        }

        super.onDestroy();
    }

    @Override
    protected void onReadyToClose() {
        removeTaskOnFinish = true;
        super.onReadyToClose();
    }

    @Override
    protected void onConferenceTerminated(HashMap<String, Object> extraData) {
        super.onConferenceTerminated(extraData);

        String conferenceUrl = extraData == null ? null : String.valueOf(extraData.get("url"));
        Intent intent = new Intent(this, RecordingsActivity.class);

        if (conferenceUrl != null && !conferenceUrl.isEmpty() && !"null".equals(conferenceUrl)) {
            intent.putExtra(RecordingsActivity.EXTRA_SERVER_BASE_URL, buildServerBaseUrl(conferenceUrl));
        }

        if (RecordingStore.hasRecordings(this) || intent.hasExtra(RecordingsActivity.EXTRA_SERVER_BASE_URL)) {
            startActivity(intent);
        }
    }

    @Override
    protected void onRecordingLinkAvailable(HashMap<String, Object> extraData) {
        super.onRecordingLinkAvailable(extraData);

        RecordingStore.upsertRecording(this, extraData);
    }

    @Override
    public void finish() {
        if (removeTaskOnFinish && isTaskRoot() && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            super.finishAndRemoveTask();
            return;
        }

        super.finish();
    }

    private void setJitsiMeetConferenceDefaultOptions() {
        Bundle recordingService = new Bundle();
        recordingService.putBoolean("enabled", true);
        recordingService.putBoolean("sharingEnabled", true);
        recordingService.putBoolean("hideStorageWarning", true);

        Bundle recordings = new Bundle();
        recordings.putBoolean("showRecordingLink", true);
        recordings.putBoolean("suggestRecording", true);

        ArrayList<Bundle> customToolbarButtons = new ArrayList<>();
        Bundle audioExtractionButton = new Bundle();
        audioExtractionButton.putString("id", "audio-extraction");
        audioExtractionButton.putString("text", "Audio Extraction");
        customToolbarButtons.add(audioExtractionButton);

        // Set default options
        JitsiMeetConferenceOptions defaultOptions
            = new JitsiMeetConferenceOptions.Builder()
            .setServerURL(buildURL("https://cdn-meet.melpapp.com/"))
            // .setServerURL(buildURL("https://meet.jit.si/"))
            .setFeatureFlag("welcomepage.enabled", true)
            .setFeatureFlag("recording.enabled", true)
            .setConfigOverride("recordingService", recordingService)
            .setConfigOverride("recordings", recordings)
            .setConfigOverride("customToolbarButtons", customToolbarButtons)
            .setToken("")
            .setFeatureFlag("server-url-change.enabled", !configurationByRestrictions)
            
            .build();
        JitsiMeet.setDefaultConferenceOptions(defaultOptions);
         new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                JitsiMeetConferenceOptions defaultOptions1
                        = new JitsiMeetConferenceOptions.Builder()
                       .setRoom("33434012302f5aaa4fe3a248f6f66438")
                        .build();
                join(defaultOptions1);
            }
        }, 500);
    }

    private String buildServerBaseUrl(String conferenceUrl) {
        int lastSlash = conferenceUrl.lastIndexOf('/');

        if (lastSlash <= conferenceUrl.indexOf("://") + 2) {
            return conferenceUrl.endsWith("/") ? conferenceUrl : conferenceUrl + "/";
        }

        return conferenceUrl.substring(0, lastSlash + 1);
    }

    private void resolveRestrictions() {
        RestrictionsManager manager =
            (RestrictionsManager) getSystemService(Context.RESTRICTIONS_SERVICE);
        Bundle restrictions = manager.getApplicationRestrictions();
        Collection<RestrictionEntry> entries = manager.getManifestRestrictions(
            getApplicationContext().getPackageName());
        for (RestrictionEntry restrictionEntry : entries) {
            String key = restrictionEntry.getKey();
            if (RESTRICTION_SERVER_URL.equals(key)) {
                // If restrictions are passed to the application.
                if (restrictions != null &&
                    restrictions.containsKey(RESTRICTION_SERVER_URL)) {
                    defaultURL = restrictions.getString(RESTRICTION_SERVER_URL);
                    configurationByRestrictions = true;
                // Otherwise use default URL from app-restrictions.xml.
                } else {
                    defaultURL = restrictionEntry.getSelectedString();
                    configurationByRestrictions = false;
                }
            }
        }
    }

    // Activity lifecycle method overrides
    //

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Settings.canDrawOverlays(this)) {
                initialize();
                return;
            }

            throw new RuntimeException("Overlay permission is required when running in Debug mode.");
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    // ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_MENU) {
            JitsiMeet.showDevOptions();
            return true;
        }

        return super.onKeyUp(keyCode, event);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode);

        Log.d(TAG, "Is in picture-in-picture mode: " + isInPictureInPictureMode);
    }

    // Helper methods
    //

    private @Nullable URL buildURL(String urlStr) {
        try {
            return new URL(urlStr);
        } catch (Exception e) {
            return null;
        }
    }
}
