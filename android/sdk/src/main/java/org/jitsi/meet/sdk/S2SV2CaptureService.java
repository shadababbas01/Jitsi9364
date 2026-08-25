/*
 * Copyright @ 2026-present 8x8, Inc.
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

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

/**
 * Foreground service that keeps the S2S v2 microphone capture session alive while utterances are being
 * collected and handed to the transcription pipeline.
 */
public class S2SV2CaptureService extends Service {
    private static final String TAG = S2SV2CaptureService.class.getSimpleName();
    private static final String CHANNEL_ID = "S2SV2CaptureChannel";
    private static final int NOTIFICATION_ID = 49527;

    public static void launch(Context context) {
        Intent intent = new Intent(context, S2SV2CaptureService.class);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (RuntimeException e) {
            // Foreground service starts are restricted when the app is backgrounded on newer Android releases.
            JitsiMeetLogger.w(e, TAG + " could not start foreground capture service");
        }
    }

    public static void abort(Context context) {
        Intent intent = new Intent(context, S2SV2CaptureService.class);
        context.stopService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();

        createNotificationChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getResources().getIdentifier("ic_notification", "drawable", getPackageName()))
            .setContentTitle(getString(R.string.s2s_v2_capture_notification_title))
            .setContentText(getString(R.string.s2s_v2_capture_notification_text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " could not enter foreground mode");
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager == null) {
            return;
        }

        NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);

        if (channel != null) {
            return;
        }

        channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.s2s_v2_capture_notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.enableLights(false);
        channel.enableVibration(false);
        channel.setShowBadge(false);

        notificationManager.createNotificationChannel(channel);
    }
}
