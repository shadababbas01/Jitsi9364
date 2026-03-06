package org.jitsi.meet;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;

import com.oney.WebRTCModule.WebRTCModuleOptions;

import org.jitsi.meet.sdk.JitsiMeet;
import org.jitsi.meet.sdk.JitsiMeetActivity;
import org.jitsi.meet.sdk.JitsiMeetConferenceOptions;
import org.webrtc.Logging;

import java.net.URL;

public class MainActivity extends JitsiMeetActivity {

    private static final int OVERLAY_PERMISSION_REQUEST_CODE =
            (int) (Math.random() * Short.MAX_VALUE);

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        // Show splash screen
        JitsiMeet.showSplashScreen(this);

        // Reduce WebRTC logs
        WebRTCModuleOptions options = WebRTCModuleOptions.getInstance();
        options.loggingSeverity = Logging.Severity.LS_ERROR;

        super.onCreate(null);

        // Join room automatically
        joinConference();
    }

private void joinConference() {
    try {

        JitsiMeetConferenceOptions options =
                new JitsiMeetConferenceOptions.Builder()
                        .setServerURL(new URL("https://meet.jit.si"))
                        .setRoom("shadab1")

                        // User Info (Correct way for SDK 11.6.3)
                        // .setUserDisplayName("MobileUser")
                        // .setUserAvatarURL("https://picsum.photos/id/237/200/300")

                        // Feature Flags
                        .setFeatureFlag("welcomepage.enabled", false)
                        .setFeatureFlag("call-integration.enabled", false)
                        .setFeatureFlag("resolution", 360)

                        // Audio Only
                        .setAudioOnly(true)

                        .build();

        join(options);

    } catch (Exception e) {
        e.printStackTrace();
    }
}

    @Override
    protected boolean extraInitialize() {

        if (BuildConfig.DEBUG && !Settings.canDrawOverlays(this)) {

            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())
            );

            startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE);
            return true;
        }

        return false;
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {

        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Settings.canDrawOverlays(this)) {
                joinConference();
                return;
            }
            throw new RuntimeException(
                    "Overlay permission is required when running in Debug mode."
            );
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {

        if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_MENU) {
            JitsiMeet.showDevOptions();
            return true;
        }

        return super.onKeyUp(keyCode, event);
    }
}