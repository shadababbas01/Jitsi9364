package org.jitsi.meet.sdk;

import android.content.Intent;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.ToneGenerator;
import android.os.CountDownTimer;
import android.os.Handler;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableNativeMap;

import java.util.ArrayList;

import javax.annotation.Nonnull;

public class OpenMelpModule extends ReactContextBaseJavaModule {
    ReactApplicationContext context;
    ArrayList<String> emailList;
    int totalcount = 0, totalcountForBeepSound = 0;
    String updatedUserName = "";
    String signalLevel = "0";
    CountDownTimer cTimer = null;


    public OpenMelpModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
        context = reactContext;
        emailList = new ArrayList<>();

    }

    @Nonnull
    @Override
    public String getName() {
        return "NativeCallsNew";
    }

    @ReactMethod
    public void showToast() {
        Intent i = new Intent();
        i.setAction("MeetCallBack");
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void wifiStatus(int status) {

    }

    @ReactMethod
    public void showDesktop() {
        try {
            for (int i = 0; i < 2; i++) {
                // Toast toast = Toast.makeText(context, "Coming soon...", Toast.LENGTH_LONG);
                // toast.show();
            }

        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @ReactMethod
    public void addToCall() {
        Intent i = new Intent();
        i.setAction("MeetCallBackAddToCall");
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void OpenChat() {

        Intent i = new Intent();
        i.setAction("MeetCallBack");
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void hangup() {

        Intent i = new Intent();
        i.setAction("HangUpFromJitsi");
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void pipMode() {

        Toast toast = Toast.makeText(context, "PIP Mode", Toast.LENGTH_LONG);
        toast.show();
      /*  Intent i = new Intent();
        i.setAction("HangUpFromJitsi");
        getReactApplicationContext().sendBroadcast(i);*/
    }

    @ReactMethod
    public void etharpad() {

    }

    @ReactMethod
    public void etharpadinside(String url) {

        Intent i = new Intent();
        i.setAction("etharpadurl");
        i.putExtra("url", url);
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void showAttendeeeees() {
        try {
            Intent i = new Intent();
            i.setAction("MeetCallBackViewAttendeesjitsi");
            getReactApplicationContext().sendBroadcast(i);
        } catch (Exception ex) {
            ex.printStackTrace();
        }

    }

    @ReactMethod
    public void viewAttendeesjitsi(ReadableArray strings) {
        try {
            emailList.clear();
            for (int j = 0; j < strings.size(); j++) {
                emailList.add(strings.getString(j));
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @ReactMethod
    public void viewAttendees() {
        Intent i = new Intent();
        i.setAction("MeetCallBackViewAttendeesjitsi");
        i.putExtra("arraylist", emailList);
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void etharpadclick() {
        Intent i = new Intent();
        i.setAction("etharclicked");
        getReactApplicationContext().sendBroadcast(i);
    }

    @ReactMethod
    public void totalUsers(int mCount) {
        Log.e("totalUsers--->", mCount + "");
        totalcountForBeepSound = mCount;
        if (mCount != totalcount) {
            totalcount = mCount;
            Intent i = new Intent();
            i.setAction("totalUsers");
            i.putExtra("totalusercounts", mCount + "");
            getReactApplicationContext().sendBroadcast(i);
        }

    }

    @ReactMethod
    public void updatedUserName(String username) {
        if (! username.equalsIgnoreCase(updatedUserName)) {
            updatedUserName = username;
            Intent i = new Intent();
            i.setAction("updatedUserName");
            i.putExtra("updatedusername", username);
            getReactApplicationContext().sendBroadcast(i);
        }

    }

    @ReactMethod
    public void showAttendees(ReadableArray strings) {
        try {
            emailList.clear();
            for (int j = 0; j < strings.size(); j++) {
                emailList.add(strings.getString(j));
            }
            Intent i = new Intent();
            i.setAction("MeetCallBackViewAttendeesjitsi");
            i.putExtra("arraylist", emailList);
            getReactApplicationContext().sendBroadcast(i);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @ReactMethod
    public void lowSignal(String signal) {
        Log.e("lowSignal--->", signal + " totalcountForBeepSound---"+totalcountForBeepSound);
        if(!signalLevel.equalsIgnoreCase(signal)) {
            signalLevel = signal;
            if (signalLevel.equalsIgnoreCase("0") && totalcountForBeepSound <=2 ) {
                displayStatus("Reconnecting");
                playBeepSound();
                startTimer();
            } else {
                    displayStatus("Connected");
                    cancelTimer();
            }
        }
    }
    //start timer
    void startTimer() {
        try {
            cTimer = new CountDownTimer(15000, 1000) {
                public void onTick(long millisUntilFinished) {

                    new Handler().postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            playBeepSound();
                        }
                    }, 7000);
                }
                public void onFinish() {
                    if(totalcountForBeepSound<=2) {
                        Intent i = new Intent();
                        i.setAction("HangUpFromJitsi");
                        getReactApplicationContext().sendBroadcast(i);
                    }
                }
            };
            cTimer.start();
        }catch (Exception ex){
            ex.printStackTrace();
        }
    }
    //cancel timer
    void cancelTimer() {
        try {
            if (cTimer != null)
                cTimer.cancel();
        }catch ( Exception ex){
            ex.printStackTrace();
        }
    }

    public void displayStatus(String status){
        try {
                WritableNativeMap data = new WritableNativeMap();
                data.putString("status", status);
                ReactInstanceManagerHolder.emitEvent("connectionStatus", data);
        }catch (Exception ex){
            ex.printStackTrace();
        }
    }

    public synchronized void playBeepSound() {
        try {

            new Handler().postDelayed(new Runnable() {
                @Override
                public void run() {
                    ToneGenerator toneGen1 = new ToneGenerator(AudioManager.STREAM_MUSIC, 100);
                    toneGen1.startTone(ToneGenerator.TONE_CDMA_PIP, 5000);
                }
                },1000);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

}