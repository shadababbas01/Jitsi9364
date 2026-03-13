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
import java.util.Collection;

/**
 * The one and only Activity that the Jitsi Meet app needs. The
 * {@code Activity} is launched in {@code singleTask} mode, so it will be
 * created upon application initialization and there will be a single instance
 * of it. Further attempts at launching the application once it was already
 * launched will result in {@link MainActivity#onNewIntent(Intent)} being called.
 */
public class MainActivity extends JitsiMeetActivity {
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

    private void setJitsiMeetConferenceDefaultOptions() {

        // Set default options
        JitsiMeetConferenceOptions defaultOptions
            = new JitsiMeetConferenceOptions.Builder()
            // .setServerURL(buildURL("https://meetdev.melp.us/"))
            .setServerURL(buildURL(defaultURL))
            .setFeatureFlag("welcomepage.enabled", true)
            .setToken("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb252aWQiOiIxMTY1NjMzNzMwXzg4cDh2bWQyIiwiYXVkIjoibWVscF9jb25mIiwic3ViIjoibWVldGRldi5tZWxwLnVzIiwibW9kZXJhdG9yIjp0cnVlLCJpc3MiOiJtZWxwX2NvbmZfOCIsImNvbnRleHQiOnsiY2FsbGVlIjp7Im5hbWUiOiIiLCJpZCI6Ijg4cDh2bWQyIiwiYXZhdGFyIjoiIiwiZW1haWwiOiIifSwidXNlciI6eyJuYW1lIjoiU2hhZGFiIEFiYmFzIiwiaWQiOiI4OHA4dm1kMiIsImF2YXRhciI6Imh0dHBzOi8vdXMtYXBpLm1lbHAudXMvZG93bmxvYWQvdjAvODhwOHZtYW11azh3Lzg5NDZAdXNlci5qcGVnP3Nlc3Npb25pZD15YklCWUJFVGRHQ0RMbUhEYnRvOGFpSkNSTTBjTFU5OWJTSjN4UFRTWXhiNCZpc3RodW1iPTEiLCJlbWFpbCI6Ijg4cDh2bWQyQG1lbHAuY29tIn0sImdyb3VwIjoib25ldG9vbmUifSwiaWF0IjoxNzczMzE2ODUxLCJyb29tIjoiYzVhYTc0MDY1NzkyNmY4Y2M2MjgyNmQ5MWEwYmNlMDgiLCJyb29tTmFtZSI6IlNoYWRhYiBBYmJhcyIsImV4cCI6MTc3MzM2MDA1MX0.ub1tTfogwbLGK1In7sRfPycoyzvkF7GFKuuWP3jgSqQ")
            .setFeatureFlag("server-url-change.enabled", !configurationByRestrictions)
            
            .build();
        JitsiMeet.setDefaultConferenceOptions(defaultOptions);
         new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                JitsiMeetConferenceOptions defaultOptions1
                        = new JitsiMeetConferenceOptions.Builder()
                       .setRoom("c5aa740657926f8cc62826d91a0bce08")
                        .build();
                join(defaultOptions1);
            }
        }, 500);
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
