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

import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.encoders.Hex;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.security.spec.AlgorithmParameterSpec;
import java.util.Calendar;

import javax.annotation.Nonnull;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.spec.IvParameterSpec;

/**
 * Small crypto bridge used to decrypt Melp upload responses.
 */
public class MelpCryptoModule extends ReactContextBaseJavaModule {
    private static final String NAME = "MelpCrypto";
    private static final String TAG = NAME;
    private static Cipher encrypterWithPad;
    private static Cipher decrypterWithPad;

    static {
        try {
            Security.addProvider(new BouncyCastleProvider());
            encrypterWithPad = Cipher.getInstance("AES/CBC/PKCS5PADDING", "BC");
            decrypterWithPad = Cipher.getInstance("AES/CBC/PKCS5PADDING", "BC");
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    public MelpCryptoModule(@Nonnull ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Nonnull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void decryptString(String input, String key, String algo, Promise promise) {
        try {
            if (input == null || input.trim().isEmpty() || key == null || key.trim().isEmpty()) {
                promise.resolve(null);

                return;
            }

            byte[] inputBytes = Base64.decode(input, Base64.DEFAULT);
            promise.resolve(decryptString(inputBytes, key, algo));
        } catch (Exception e) {
            JitsiMeetLogger.w(e, TAG + " failed to decrypt string");
            promise.reject("decrypt_error", "Failed to decrypt string", e);
        }
    }

    public String decryptString(byte[] input, String key, String algo) {
        if (input != null && key != null && !key.trim().isEmpty()) {
            this.initCiphers();
            byte[] buffer1 = null;

            try {
                SecretKey secretKey = new SecretKeySpec(Hex.decode(key), "AES");
                AlgorithmParameterSpec IVspec = new IvParameterSpec("0123456789ABCDEF".getBytes());
                long starttime = Calendar.getInstance().getTimeInMillis();
                decrypterWithPad.init(2, secretKey, IVspec);
                buffer1 = new byte[input.length];
                decrypterWithPad.doFinal(input, 0, input.length, buffer1);
                long endtime = Calendar.getInstance().getTimeInMillis();
                System.out.println("Time to decrypt is " + (endtime - starttime));
                String var12 = (new String(buffer1, Charset.forName("UTF-8"))).trim();
                return var12;
            } catch (Exception ex) {
                ex.printStackTrace();
                return null;
            } finally {
                ;
            }
        } else {
            System.out.println("Either input or key is empty. Empty items can not be processed");
            return null;
        }
    }

    private void initCiphers() {
        if (encrypterWithPad == null || decrypterWithPad == null) {
            try {
                encrypterWithPad = Cipher.getInstance("AES/CBC/PKCS5PADDING", "BC");
                decrypterWithPad = Cipher.getInstance("AES/CBC/PKCS5PADDING", "BC");
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }
}
