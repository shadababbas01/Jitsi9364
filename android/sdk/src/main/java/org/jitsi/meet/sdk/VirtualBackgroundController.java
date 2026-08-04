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

import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.Segmentation;
import com.google.mlkit.vision.segmentation.SegmentationMask;
import com.google.mlkit.vision.segmentation.Segmenter;
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions;
import com.oney.WebRTCModule.videoEffects.ProcessorProvider;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Process-wide state backing the real time virtual background feature: which background is
 * currently selected, the decoded background image and the (shared) ML Kit selfie segmenter
 * together with the most recently produced segmentation mask.
 *
 * The actual per frame work lives in {@link VirtualBackgroundProcessor}, which is instantiated
 * once per {@code MediaStreamTrack._setVideoEffect()} call. Keeping the segmenter here means it
 * is created at most once for the lifetime of the process no matter how often the user toggles
 * the effect, and that a freshly created processor immediately has a usable mask.
 *
 * Because the effect is installed as a {@code VideoProcessor} on the capturer's
 * {@code VideoSource}, it applies to every consumer of the local camera track: the local
 * thumbnail, the large video, and the encoded stream every remote participant receives.
 */
class VirtualBackgroundController {
    /**
     * The name this effect is registered under with react-native-webrtc's
     * {@link ProcessorProvider}. The JavaScript side passes the same string to
     * {@code MediaStreamTrack._setVideoEffect()}.
     */
    static final String PROCESSOR_NAME = "JitsiVirtualBackground";

    /**
     * No background processing at all; frames are passed through untouched.
     */
    static final int MODE_NONE = 0;

    /**
     * The camera background is blurred.
     */
    static final int MODE_BLUR = 1;

    /**
     * The camera background is replaced by {@link #backgroundBitmap}.
     */
    static final int MODE_IMAGE = 2;

    private static final String TAG = "VirtualBackground";

    /**
     * Longest edge the background image is decoded at. Backgrounds are only ever drawn at video
     * resolution, so decoding the full sized picture would just waste memory.
     */
    private static final int MAX_BACKGROUND_DIMENSION = 1920;

    private static VirtualBackgroundController instance;

    /**
     * Runs the segmentation requests. ML Kit's stream mode keeps state between invocations, so a
     * single thread is used rather than a pool.
     */
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Guards against queueing a new segmentation request while one is still running. Frames which
     * arrive in the meantime are composited with {@link #latestMask}, which keeps the output at
     * capture frame rate even though inference is slower than that.
     */
    private final AtomicBoolean inferenceInFlight = new AtomicBoolean(false);

    private Bitmap backgroundBitmap;

    /**
     * Identifies {@link #backgroundBitmap} so the processor can tell when its scaled/rotated cache
     * became stale.
     */
    private String backgroundKey;

    private volatile int blurValue = 25;

    private volatile MaskData latestMask;

    private volatile int mode = MODE_NONE;

    private Segmenter segmenter;

    static synchronized VirtualBackgroundController getInstance() {
        if (instance == null) {
            instance = new VirtualBackgroundController();
        }

        return instance;
    }

    private VirtualBackgroundController() {
        ProcessorProvider.addProcessor(PROCESSOR_NAME, VirtualBackgroundProcessor::new);
    }

    /**
     * A segmentation mask, flattened to one alpha byte per pixel.
     */
    static class MaskData {
        /**
         * Foreground (person) confidence, 0 - 255, row major, {@link #width} * {@link #height}
         * entries.
         */
        final byte[] alpha;

        final int height;

        /**
         * The rotation, in degrees, which was applied to the frame before it was handed to the
         * segmenter. The mask is expressed in that rotated coordinate space.
         */
        final int rotation;

        final int width;

        MaskData(byte[] alpha, int width, int height, int rotation) {
            this.alpha = alpha;
            this.width = width;
            this.height = height;
            this.rotation = rotation;
        }
    }

    int getMode() {
        return mode;
    }

    int getBlurValue() {
        return blurValue;
    }

    MaskData getLatestMask() {
        return latestMask;
    }

    /**
     * Whether a new frame may be handed to the segmenter. Callers must check this before writing
     * into the buffer they pass to {@link #maybeSegment}, because that buffer is handed to ML Kit
     * by reference and stays in use for the duration of the request.
     *
     * @returns {boolean} - Whether no inference is currently running.
     */
    boolean canSegment() {
        return !inferenceInFlight.get();
    }

    synchronized Bitmap getBackgroundBitmap() {
        return backgroundBitmap;
    }

    synchronized String getBackgroundKey() {
        return backgroundKey;
    }

    /**
     * Turns the effect off and drops every cached resource. Called when the JavaScript side
     * selects the "none" background.
     */
    synchronized void clear() {
        mode = MODE_NONE;
        backgroundKey = null;
        backgroundBitmap = null;
        latestMask = null;
    }

    /**
     * Switches to background blur.
     *
     * @param blurValue - Blur strength, using the same 0 - 30 scale as the web client.
     */
    synchronized void setBlur(int blurValue) {
        this.blurValue = blurValue;
        backgroundKey = null;
        backgroundBitmap = null;
        mode = MODE_BLUR;
    }

    /**
     * Switches to a replacement image.
     *
     * @param context - Context used to resolve {@code uri}.
     * @param uri - An {@code asset:}, {@code file:} or {@code content:} URI pointing at the image.
     * @throws IOException If the image cannot be read or decoded.
     */
    synchronized void setImage(Context context, String uri) throws IOException {
        Bitmap bitmap = decodeBitmap(context, uri);

        if (bitmap == null) {
            throw new IOException("Could not decode background image: " + uri);
        }

        backgroundBitmap = bitmap;
        backgroundKey = uri;
        mode = MODE_IMAGE;
    }

    /**
     * Hands a frame to the segmenter unless a previous request is still running.
     *
     * @param nv21 - The frame, as NV21 bytes. Must not be modified until the caller sees
     * {@link #inferenceInFlight} go back to {@code false}; {@link VirtualBackgroundProcessor} only
     * refills its buffer when no request is in flight, which satisfies that.
     * @param width - Frame width, in pixels.
     * @param height - Frame height, in pixels.
     * @param rotation - The frame's rotation metadata, in degrees.
     */
    void maybeSegment(byte[] nv21, int width, int height, int rotation) {
        if (!inferenceInFlight.compareAndSet(false, true)) {
            return;
        }

        InputImage image;

        try {
            image = InputImage.fromByteArray(nv21, width, height, rotation, InputImage.IMAGE_FORMAT_NV21);
        } catch (Throwable t) {
            inferenceInFlight.set(false);
            JitsiMeetLogger.e(t, TAG + " could not wrap frame for segmentation");

            return;
        }

        try {
            getSegmenter()
                .process(image)
                .addOnSuccessListener(executor, mask -> latestMask = toMaskData(mask, rotation))
                .addOnFailureListener(executor, e -> JitsiMeetLogger.e(e, TAG + " segmentation failed"))
                .addOnCompleteListener(executor, task -> inferenceInFlight.set(false));
        } catch (Throwable t) {
            inferenceInFlight.set(false);
            JitsiMeetLogger.e(t, TAG + " could not run segmentation");
        }
    }

    private synchronized Segmenter getSegmenter() {
        if (segmenter == null) {
            segmenter = Segmentation.getClient(new SelfieSegmenterOptions.Builder()
                .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
                .build());
        }

        return segmenter;
    }

    /**
     * Flattens an ML Kit mask into one alpha byte per pixel so that compositing can use integer
     * arithmetic.
     *
     * @param mask - The mask produced by the segmenter.
     * @param rotation - The rotation the mask is expressed in.
     * @return The flattened mask.
     */
    private static MaskData toMaskData(SegmentationMask mask, int rotation) {
        int width = mask.getWidth();
        int height = mask.getHeight();
        ByteBuffer buffer = mask.getBuffer();

        buffer.rewind();

        FloatBuffer confidences = buffer.asFloatBuffer();
        int size = Math.min(width * height, confidences.remaining());
        byte[] alpha = new byte[width * height];

        for (int i = 0; i < size; i++) {
            int value = (int) (confidences.get(i) * 255f + 0.5f);

            alpha[i] = (byte) (value < 0 ? 0 : Math.min(value, 255));
        }

        return new MaskData(alpha, width, height, rotation);
    }

    /**
     * Decodes an image, downscaling it to at most {@link #MAX_BACKGROUND_DIMENSION} on its longest
     * edge.
     *
     * @param context - Context used to resolve {@code uri}.
     * @param uri - The image location.
     * @return The decoded bitmap, or {@code null} if it could not be decoded.
     * @throws IOException If the image cannot be read.
     */
    private static Bitmap decodeBitmap(Context context, String uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();

        bounds.inJustDecodeBounds = true;

        try (InputStream in = openStream(context, uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }

        BitmapFactory.Options options = new BitmapFactory.Options();

        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        options.inSampleSize = 1;

        int longestEdge = Math.max(bounds.outWidth, bounds.outHeight);

        while (longestEdge / options.inSampleSize > MAX_BACKGROUND_DIMENSION) {
            options.inSampleSize *= 2;
        }

        try (InputStream in = openStream(context, uri)) {
            return BitmapFactory.decodeStream(in, null, options);
        }
    }

    /**
     * Opens an image URI. Bundled backgrounds live in the SDK's assets and are addressed with the
     * {@code file:///android_asset/} form React Native's {@code Image} understands, so that the
     * same URI can be used for the picker thumbnails and for compositing.
     *
     * @param context - Context used to resolve {@code uri}.
     * @param uri - The image location.
     * @return A stream over the image bytes.
     * @throws IOException If the image cannot be opened.
     */
    private static InputStream openStream(Context context, String uri) throws IOException {
        String assetPrefix = "file:///android_asset/";

        if (uri.startsWith(assetPrefix)) {
            return context.getAssets().open(uri.substring(assetPrefix.length()));
        }

        if (uri.startsWith("asset:///")) {
            return context.getAssets().open(uri.substring("asset:///".length()));
        }

        if (uri.startsWith(ContentResolver.SCHEME_CONTENT + ":")) {
            InputStream in = context.getContentResolver().openInputStream(Uri.parse(uri));

            if (in == null) {
                throw new IOException("Could not open " + uri);
            }

            return in;
        }

        Uri parsed = Uri.parse(uri);
        String path = parsed.getScheme() == null ? uri : parsed.getPath();

        if (path == null) {
            throw new IOException("Could not open " + uri);
        }

        return new java.io.FileInputStream(path);
    }
}
