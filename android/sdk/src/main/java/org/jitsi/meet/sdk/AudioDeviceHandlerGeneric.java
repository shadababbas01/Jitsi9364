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
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import androidx.annotation.RequiresApi;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;


/**
 * {@link AudioModeModule.AudioDeviceHandlerInterface} module implementing device handling for
 * all post-M Android versions. This handler can be used on any Android versions >= M, but by
 * default it's only used on versions < O, since versions >= O use ConnectionService, but it
 * can be disabled.
 */
class AudioDeviceHandlerGeneric implements
        AudioModeModule.AudioDeviceHandlerInterface,
        AudioManager.OnAudioFocusChangeListener {

    private final static String TAG = AudioDeviceHandlerGeneric.class.getSimpleName();

    /**
     * Reference to the main {@code AudioModeModule}.
     */
    private AudioModeModule module;

    /**
     * Constant defining a Hearing Aid. Only available on API level >= 28.
     * The value of: AudioDeviceInfo.TYPE_HEARING_AID
     */
    private static final int TYPE_HEARING_AID = 23;

    /**
     * Constant defining a USB headset. Only available on API level >= 26.
     * The value of: AudioDeviceInfo.TYPE_USB_HEADSET
     */
    private static final int TYPE_USB_HEADSET = 22;

    /**
     * Indicator that we have lost audio focus.
     */
    private boolean audioFocusLost = false;

    /**
     * {@link AudioManager} instance used to interact with the Android audio
     * subsystem.
     */
    private AudioManager audioManager;

    /**
     * {@link Runnable} for running audio device detection in the audio thread.
     * This is only used on Android >= M.
     */
    private final Runnable onAudioDeviceChangeRunner = new Runnable() {
        @Override
        public void run() {
            Set<String> devices = new HashSet<>();
            AudioDeviceInfo[] deviceInfos = audioManager.getDevices(AudioManager.GET_DEVICES_ALL);

            for (AudioDeviceInfo info: deviceInfos) {
                switch (info.getType()) {
                    case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                        devices.add(AudioModeModule.DEVICE_BLUETOOTH);
                        break;
                    case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                        devices.add(AudioModeModule.DEVICE_EARPIECE);
                        break;
                    case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                    case AudioDeviceInfo.TYPE_HDMI:
                        devices.add(AudioModeModule.DEVICE_SPEAKER);
                        break;
                    case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                    case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                    case TYPE_HEARING_AID:
                    case TYPE_USB_HEADSET:
                        devices.add(AudioModeModule.DEVICE_HEADPHONES);
                        break;
                }
            }

            module.replaceDevices(devices);

            JitsiMeetLogger.i(TAG + " Available audio devices: " + devices.toString());

            module.updateAudioRoute();
        }
    };

    private final android.media.AudioDeviceCallback audioDeviceCallback =
        new android.media.AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(
                AudioDeviceInfo[] addedDevices) {
                JitsiMeetLogger.d(TAG + " Audio devices added");
                onAudioDeviceChange();
            }

            @Override
            public void onAudioDevicesRemoved(
                AudioDeviceInfo[] removedDevices) {
                JitsiMeetLogger.d(TAG + " Audio devices removed");
                onAudioDeviceChange();
            }
        };

    public AudioDeviceHandlerGeneric(AudioManager audioManager) {
        this.audioManager = audioManager;
    }

    /**
     * Helper method to trigger an audio route update when devices change. It
     * makes sure the operation is performed on the audio thread.
     */
    private void onAudioDeviceChange() {
        module.runInAudioThread(onAudioDeviceChangeRunner);
    }

    /**
     * {@link AudioManager.OnAudioFocusChangeListener} interface method. Called
     * when the audio focus of the system is updated.
     *
     * @param focusChange - The type of focus change.
     */
    @Override
    public void onAudioFocusChange(final int focusChange) {
        module.runInAudioThread(new Runnable() {
            @Override
            public void run() {
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_GAIN: {
                        JitsiMeetLogger.d(TAG + " Audio focus gained");
                        // Some other application potentially stole our audio focus
                        // temporarily. Restore our mode.
                        if (audioFocusLost) {
                            module.resetAudioRoute();
                        }
                        audioFocusLost = false;
                        break;
                    }
                    case AudioManager.AUDIOFOCUS_LOSS:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: {
                        JitsiMeetLogger.d(TAG + " Audio focus lost");
                        audioFocusLost = true;
                        break;
                    }
                }
            }
        });
    }

    /**
     * Helper method to set the output route to a Bluetooth device.
     *
     * @param enabled true if Bluetooth should use used, false otherwise.
     */
    private void setBluetoothAudioRoute(boolean enabled) {
        if (enabled) {
            audioManager.startBluetoothSco();
            audioManager.setBluetoothScoOn(true);
        } else {
            audioManager.setBluetoothScoOn(false);
            audioManager.stopBluetoothSco();
        }
    }

    @Override
    public void start(AudioModeModule audioModeModule) {
        JitsiMeetLogger.i("Using " + TAG + " as the audio device handler");

        module = audioModeModule;

        // Setup runtime device change detection.
        audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);

        // Do an initial detection.
        onAudioDeviceChange();
    }

    @Override
    public void stop() {
        audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
    }

    @Override
    public void setAudioRoute(String device) {
        // setSpeakerphoneOn() and the Bluetooth SCO APIs are deprecated since
        // Android 12 and are unreliable on recent versions: switching from the
        // earpiece back to the speaker is silently ignored. Use the
        // communication device API instead.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setCommunicationRoute(device);
            return;
        }

        // Turn speaker on / off
        audioManager.setSpeakerphoneOn(device.equals(AudioModeModule.DEVICE_SPEAKER));

        // Turn bluetooth on / off
        setBluetoothAudioRoute(device.equals(AudioModeModule.DEVICE_BLUETOOTH));
    }

    /**
     * Sets the audio route on Android >= 12 (S) using
     * {@link AudioManager#setCommunicationDevice}. Must be called while the
     * audio mode is {@code MODE_IN_COMMUNICATION}.
     *
     * @param device The device to route audio to.
     */
    @RequiresApi(Build.VERSION_CODES.S)
    private void setCommunicationRoute(String device) {
        List<Integer> targetTypes = new ArrayList<>();

        switch (device) {
            case AudioModeModule.DEVICE_SPEAKER:
                targetTypes.add(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
                break;
            case AudioModeModule.DEVICE_EARPIECE:
                targetTypes.add(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE);
                break;
            case AudioModeModule.DEVICE_BLUETOOTH:
                targetTypes.add(AudioDeviceInfo.TYPE_BLUETOOTH_SCO);
                targetTypes.add(AudioDeviceInfo.TYPE_BLE_HEADSET);
                break;
            case AudioModeModule.DEVICE_HEADPHONES:
                targetTypes.add(AudioDeviceInfo.TYPE_WIRED_HEADSET);
                targetTypes.add(AudioDeviceInfo.TYPE_WIRED_HEADPHONES);
                targetTypes.add(TYPE_USB_HEADSET);
                targetTypes.add(TYPE_HEARING_AID);
                break;
        }

        List<AudioDeviceInfo> availableDevices = audioManager.getAvailableCommunicationDevices();
        AudioDeviceInfo target = null;

        outer:
        for (Integer type : targetTypes) {
            for (AudioDeviceInfo info : availableDevices) {
                if (info.getType() == type) {
                    target = info;
                    break outer;
                }
            }
        }

        // Clear the forced device first: switching directly between the
        // built-in routes (earpiece <-> speaker) is ignored on some versions
        // unless the previous selection is cleared.
        audioManager.clearCommunicationDevice();

        if (target == null) {
            JitsiMeetLogger.w(TAG + " No communication device found for " + device + ", using default routing");
            return;
        }

        boolean success = audioManager.setCommunicationDevice(target);
        JitsiMeetLogger.i(TAG + " setCommunicationDevice(" + device + ") => " + success);
    }

    @Override
    public boolean setMode(int mode) {
        if (mode == AudioModeModule.DEFAULT) {
            audioFocusLost = false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                audioManager.clearCommunicationDevice();
            } else {
                audioManager.setSpeakerphoneOn(false);
                setBluetoothAudioRoute(false);
            }

            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.abandonAudioFocus(this);

            return true;
        }

        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setMicrophoneMute(false);

        int gotFocus = audioManager.requestAudioFocus(new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAcceptsDelayedFocusGain(true)
            .setOnAudioFocusChangeListener(this)
            .build()
        );

        if (gotFocus == AudioManager.AUDIOFOCUS_REQUEST_FAILED) {
            JitsiMeetLogger.w(TAG + " Audio focus request failed");
            return false;
        }

        return true;
    }
}
