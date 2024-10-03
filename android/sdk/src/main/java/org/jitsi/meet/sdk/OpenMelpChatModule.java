package org.jitsi.meet.sdk;

import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;

import java.util.ArrayList;

import javax.annotation.Nonnull;

@ReactModule(name = OpenMelpChatModule.NAME)
public class OpenMelpChatModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OpenMelpChat";
    ArrayList<String> emailList;
    private boolean isAudioCall = false;


    public OpenMelpChatModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
        emailList = new ArrayList<>();

    }

    @ReactMethod
    public void holdclick(boolean ishold) {

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
    public void isAudioMode(boolean isAudioMode) {
        if(isAudioCall!=isAudioMode) {
            isAudioCall = isAudioMode;
            Intent i = new Intent();
            i.setAction("audiomode");
            if (isAudioMode) {
                i.putExtra("value", "1");
            } else {
                i.putExtra("value", "0");

            }
            getReactApplicationContext().sendBroadcast(i);
        }
    }


    @ReactMethod
    public void showDesktop() {
        try {
            // Toast.makeText(getReactApplicationContext(), "Coming soon...", Toast.LENGTH_SHORT).show();

        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @ReactMethod
    public void showToast() {
        Intent i = new Intent();
        i.setAction("MeetCallBack");
        getReactApplicationContext().sendBroadcast(i);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }
}
