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

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;

import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor;

import org.jitsi.meet.sdk.log.JitsiMeetLogger;
import org.webrtc.JavaI420Buffer;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoFrame;
import org.webrtc.YuvHelper;

import java.nio.ByteBuffer;

/**
 * Replaces or blurs the background of every frame captured by the local camera.
 *
 * The frame is composited entirely in the I420 colour space: the replacement background is
 * converted to YUV once and cached, and each frame is then a per plane alpha blend driven by the
 * segmentation mask. That avoids a YUV -> RGB -> YUV round trip per frame, which is what makes this
 * cheap enough to run on the capture thread.
 *
 * Segmentation itself is asynchronous (see {@link VirtualBackgroundController#maybeSegment}); while
 * inference runs, incoming frames are composited with the most recent mask. The mask is therefore
 * up to a couple of frames stale, which is invisible in practice and keeps the outgoing stream at
 * the full capture frame rate.
 */
class VirtualBackgroundProcessor implements VideoFrameProcessor {
    private static final String TAG = "VirtualBackgroundProcessor";

    /**
     * Alpha at or above which a pixel is taken straight from the camera, skipping the blend.
     */
    private static final int OPAQUE_ALPHA = 250;

    /**
     * Alpha at or below which a pixel is taken straight from the background, skipping the blend.
     */
    private static final int TRANSPARENT_ALPHA = 5;

    private byte[] backgroundU;
    private byte[] backgroundV;
    private byte[] backgroundY;

    /**
     * Identifies the image and the frame geometry {@link #backgroundY} was built for, so it is
     * rebuilt when the user picks another background, the capture resolution changes or the device
     * is rotated.
     */
    private String backgroundCacheKey;

    private int chromaHeight;
    private int chromaWidth;

    private byte[] foregroundU;
    private byte[] foregroundV;
    private byte[] foregroundY;

    private int height;

    /**
     * Maps a chroma column to the horizontal part of its mask index. See
     * {@link #buildMaskTables}.
     */
    private int[] maskChromaX;

    /**
     * Maps a chroma row to the vertical part of its mask index.
     */
    private int[] maskChromaY;

    /**
     * Maps a luma column to the horizontal part of its mask index.
     */
    private int[] maskLumaX;

    /**
     * Maps a luma row to the vertical part of its mask index.
     */
    private int[] maskLumaY;

    /**
     * Identifies the mask geometry {@link #maskLumaX} was built for.
     */
    private String maskCacheKey;

    private byte[] nv21;

    private byte[] outputU;
    private byte[] outputV;
    private byte[] outputY;

    private byte[] scratchU;
    private byte[] scratchV;
    private byte[] scratchY;

    private int width;

    /**
     * {@inheritDoc}
     *
     * Returning {@code null} tells react-native-webrtc's {@code VideoEffectProcessor} to forward
     * the untouched frame, which is what we want whenever the effect is off or we do not have a
     * mask (yet).
     */
    @Override
    public VideoFrame process(VideoFrame frame, SurfaceTextureHelper textureHelper) {
        VirtualBackgroundController controller = VirtualBackgroundController.getInstance();
        int mode = controller.getMode();

        if (mode == VirtualBackgroundController.MODE_NONE) {
            return null;
        }

        try {
            return processFrame(frame, controller, mode);
        } catch (Throwable t) {
            JitsiMeetLogger.e(t, TAG + " failed to process frame");

            return null;
        }
    }

    private VideoFrame processFrame(VideoFrame frame, VirtualBackgroundController controller, int mode) {
        VideoFrame.I420Buffer i420 = frame.getBuffer().toI420();

        if (i420 == null) {
            return null;
        }

        int rotation = normalizeRotation(frame.getRotation());

        try {
            if (i420.getWidth() < 2 || i420.getHeight() < 2) {
                return null;
            }

            allocate(i420.getWidth(), i420.getHeight());
            readPlane(i420.getDataY(), i420.getStrideY(), foregroundY, width, height);
            readPlane(i420.getDataU(), i420.getStrideU(), foregroundU, chromaWidth, chromaHeight);
            readPlane(i420.getDataV(), i420.getStrideV(), foregroundV, chromaWidth, chromaHeight);
        } finally {
            i420.release();
        }

        // Only refill the segmenter's input while no inference is running: the buffer is handed to
        // ML Kit by reference, and this is the only thread which submits, so this check is what
        // keeps us from overwriting a frame that is still being read.
        if (controller.canSegment()) {
            fillNv21();
            controller.maybeSegment(nv21, width, height, rotation);
        }

        VirtualBackgroundController.MaskData mask = controller.getLatestMask();

        if (mask == null) {
            return null;
        }

        if (mode == VirtualBackgroundController.MODE_BLUR) {
            buildBlurredBackground(controller.getBlurValue());
        } else if (!buildImageBackground(controller, rotation)) {
            return null;
        }

        buildMaskTables(mask, rotation);
        blend(mask.alpha);

        JavaI420Buffer output = JavaI420Buffer.allocate(width, height);

        writePlane(output.getDataY(), output.getStrideY(), outputY, width, height);
        writePlane(output.getDataU(), output.getStrideU(), outputU, chromaWidth, chromaHeight);
        writePlane(output.getDataV(), output.getStrideV(), outputV, chromaWidth, chromaHeight);

        return new VideoFrame(output, frame.getRotation(), frame.getTimestampNs());
    }

    /**
     * (Re)allocates every scratch buffer for a given frame geometry.
     *
     * @param frameWidth - Frame width, in pixels.
     * @param frameHeight - Frame height, in pixels.
     */
    private void allocate(int frameWidth, int frameHeight) {
        if (frameWidth == width && frameHeight == height) {
            return;
        }

        width = frameWidth;
        height = frameHeight;
        chromaWidth = (frameWidth + 1) / 2;
        chromaHeight = (frameHeight + 1) / 2;

        int luma = width * height;
        int chroma = chromaWidth * chromaHeight;

        foregroundY = new byte[luma];
        foregroundU = new byte[chroma];
        foregroundV = new byte[chroma];
        backgroundY = new byte[luma];
        backgroundU = new byte[chroma];
        backgroundV = new byte[chroma];
        outputY = new byte[luma];
        outputU = new byte[chroma];
        outputV = new byte[chroma];
        scratchY = new byte[luma];
        scratchU = new byte[chroma];
        scratchV = new byte[chroma];
        nv21 = new byte[luma + (chroma * 2)];
        maskLumaX = new int[width];
        maskLumaY = new int[height];
        maskChromaX = new int[chromaWidth];
        maskChromaY = new int[chromaHeight];

        // Both caches are keyed on the geometry, so force them to be rebuilt.
        backgroundCacheKey = null;
        maskCacheKey = null;
    }

    /**
     * Packs the current frame into the NV21 layout ML Kit expects.
     */
    private void fillNv21() {
        int luma = width * height;

        System.arraycopy(foregroundY, 0, nv21, 0, luma);

        int offset = luma;

        for (int i = 0, end = chromaWidth * chromaHeight; i < end; i++) {
            nv21[offset++] = foregroundV[i];
            nv21[offset++] = foregroundU[i];
        }
    }

    /**
     * Fills the background planes with a blurred copy of the current frame.
     *
     * @param blurValue - Blur strength on the same 0 - 30 scale the web client uses.
     */
    private void buildBlurredBackground(int blurValue) {
        int lumaRadius = clampRadius(Math.round((blurValue * width) / 400f), width, height);
        int chromaRadius = clampRadius(Math.max(1, lumaRadius / 2), chromaWidth, chromaHeight);

        boxBlur(foregroundY, backgroundY, scratchY, width, height, lumaRadius);
        boxBlur(foregroundU, backgroundU, scratchU, chromaWidth, chromaHeight, chromaRadius);
        boxBlur(foregroundV, backgroundV, scratchV, chromaWidth, chromaHeight, chromaRadius);
    }

    /**
     * Makes sure the background planes hold the selected image, scaled to cover the frame and
     * counter rotated so that it appears upright once the frame's rotation metadata is applied by
     * the renderer.
     *
     * @param controller - The controller holding the selected image.
     * @param rotation - The frame's rotation, in degrees.
     * @return Whether the background is ready.
     */
    private boolean buildImageBackground(VirtualBackgroundController controller, int rotation) {
        String key = controller.getBackgroundKey();

        if (key == null) {
            return false;
        }

        String cacheKey = key + '@' + rotation + '/' + width + 'x' + height;

        if (cacheKey.equals(backgroundCacheKey)) {
            return true;
        }

        Bitmap source = controller.getBackgroundBitmap();

        if (source == null || source.isRecycled()) {
            return false;
        }

        boolean swapped = rotation == 90 || rotation == 270;
        int rotatedWidth = swapped ? height : width;
        int rotatedHeight = swapped ? width : height;
        float scale = Math.max(
            (float) rotatedWidth / source.getWidth(),
            (float) rotatedHeight / source.getHeight());

        // Cover the rotated (as displayed) frame...
        Matrix matrix = new Matrix();

        matrix.setScale(scale, scale);
        matrix.postTranslate(
            (rotatedWidth - (source.getWidth() * scale)) / 2f,
            (rotatedHeight - (source.getHeight() * scale)) / 2f);

        // ...then undo the rotation the renderer is going to apply.
        matrix.postRotate(-rotation);

        switch (rotation) {
        case 90:
            matrix.postTranslate(0, rotatedWidth);
            break;
        case 180:
            matrix.postTranslate(rotatedWidth, rotatedHeight);
            break;
        case 270:
            matrix.postTranslate(rotatedHeight, 0);
            break;
        default:
            break;
        }

        Bitmap fitted = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);

        try {
            new Canvas(fitted).drawBitmap(source, matrix, new Paint(Paint.FILTER_BITMAP_FLAG));
            toI420(fitted);
        } finally {
            fitted.recycle();
        }

        backgroundCacheKey = cacheKey;

        return true;
    }

    /**
     * Converts an ARGB_8888 bitmap the size of the frame into the background planes.
     *
     * libyuv's {@code ABGRToI420} consumes bytes in R, G, B, A order, which is exactly the memory
     * layout of an {@code ARGB_8888} bitmap.
     *
     * @param bitmap - The bitmap to convert.
     */
    private void toI420(Bitmap bitmap) {
        int luma = width * height;
        int chroma = chromaWidth * chromaHeight;
        ByteBuffer argb = ByteBuffer.allocateDirect(luma * 4);

        bitmap.copyPixelsToBuffer(argb);
        argb.rewind();

        ByteBuffer dataY = ByteBuffer.allocateDirect(luma);
        ByteBuffer dataU = ByteBuffer.allocateDirect(chroma);
        ByteBuffer dataV = ByteBuffer.allocateDirect(chroma);

        YuvHelper.ABGRToI420(
            argb, width * 4,
            dataY, width,
            dataU, chromaWidth,
            dataV, chromaWidth,
            width, height);

        dataY.rewind();
        dataY.get(backgroundY, 0, luma);
        dataU.rewind();
        dataU.get(backgroundU, 0, chroma);
        dataV.rewind();
        dataV.get(backgroundV, 0, chroma);
    }

    /**
     * Builds the lookup tables which turn a frame coordinate into an index into the mask.
     *
     * The mask is expressed in the frame's rotated (as displayed) coordinate space and may have a
     * different resolution than the frame, so the mapping involves a rotation and a scale. For all
     * four rotations exactly one of the mask's coordinates depends on {@code x} and the other on
     * {@code y}, which lets the mapping collapse into two additive tables:
     * {@code index = maskLumaY[y] + maskLumaX[x]}.
     *
     * @param mask - The mask to build tables for.
     * @param rotation - The frame's rotation, in degrees.
     */
    private void buildMaskTables(VirtualBackgroundController.MaskData mask, int rotation) {
        String cacheKey = mask.width + "x" + mask.height + '@' + rotation;

        if (cacheKey.equals(maskCacheKey)) {
            return;
        }

        int maskWidth = mask.width;
        int maskHeight = mask.height;
        boolean swapped = rotation == 90 || rotation == 270;
        int rotatedWidth = swapped ? height : width;
        int rotatedHeight = swapped ? width : height;

        for (int x = 0; x < width; x++) {
            switch (rotation) {
            case 90:
                maskLumaX[x] = scale(x, rotatedHeight, maskHeight) * maskWidth;
                break;
            case 180:
                maskLumaX[x] = scale(width - 1 - x, rotatedWidth, maskWidth);
                break;
            case 270:
                maskLumaX[x] = scale(width - 1 - x, rotatedHeight, maskHeight) * maskWidth;
                break;
            default:
                maskLumaX[x] = scale(x, rotatedWidth, maskWidth);
                break;
            }
        }

        for (int y = 0; y < height; y++) {
            switch (rotation) {
            case 90:
                maskLumaY[y] = scale(height - 1 - y, rotatedWidth, maskWidth);
                break;
            case 180:
                maskLumaY[y] = scale(height - 1 - y, rotatedHeight, maskHeight) * maskWidth;
                break;
            case 270:
                maskLumaY[y] = scale(y, rotatedWidth, maskWidth);
                break;
            default:
                maskLumaY[y] = scale(y, rotatedHeight, maskHeight) * maskWidth;
                break;
            }
        }

        // Chroma is half resolution, so it reuses the luma table of its top-left luma sample.
        for (int cx = 0; cx < chromaWidth; cx++) {
            maskChromaX[cx] = maskLumaX[Math.min(cx * 2, width - 1)];
        }

        for (int cy = 0; cy < chromaHeight; cy++) {
            maskChromaY[cy] = maskLumaY[Math.min(cy * 2, height - 1)];
        }

        maskCacheKey = cacheKey;
    }

    /**
     * Alpha blends the camera planes over the background planes.
     *
     * @param alpha - Foreground confidence, one byte per mask pixel.
     */
    private void blend(byte[] alpha) {
        int maskSize = alpha.length;

        for (int y = 0; y < height; y++) {
            int row = y * width;
            int maskRow = maskLumaY[y];

            for (int x = 0; x < width; x++) {
                int maskIndex = maskRow + maskLumaX[x];
                int i = row + x;

                if (maskIndex >= maskSize) {
                    // The lookup tables keep this from happening; fall back to the camera rather
                    // than leaving whatever the previous frame put here.
                    outputY[i] = foregroundY[i];

                    continue;
                }

                int a = alpha[maskIndex] & 0xff;

                if (a >= OPAQUE_ALPHA) {
                    outputY[i] = foregroundY[i];
                } else if (a <= TRANSPARENT_ALPHA) {
                    outputY[i] = backgroundY[i];
                } else {
                    outputY[i] = (byte) ((((foregroundY[i] & 0xff) * a)
                        + ((backgroundY[i] & 0xff) * (255 - a))) / 255);
                }
            }
        }

        for (int cy = 0; cy < chromaHeight; cy++) {
            int row = cy * chromaWidth;
            int maskRow = maskChromaY[cy];

            for (int cx = 0; cx < chromaWidth; cx++) {
                int maskIndex = maskRow + maskChromaX[cx];
                int i = row + cx;

                if (maskIndex >= maskSize) {
                    outputU[i] = foregroundU[i];
                    outputV[i] = foregroundV[i];

                    continue;
                }

                int a = alpha[maskIndex] & 0xff;

                if (a >= OPAQUE_ALPHA) {
                    outputU[i] = foregroundU[i];
                    outputV[i] = foregroundV[i];
                } else if (a <= TRANSPARENT_ALPHA) {
                    outputU[i] = backgroundU[i];
                    outputV[i] = backgroundV[i];
                } else {
                    int inverse = 255 - a;

                    outputU[i] = (byte) ((((foregroundU[i] & 0xff) * a)
                        + ((backgroundU[i] & 0xff) * inverse)) / 255);
                    outputV[i] = (byte) ((((foregroundV[i] & 0xff) * a)
                        + ((backgroundV[i] & 0xff) * inverse)) / 255);
                }
            }
        }
    }

    /**
     * Scales a coordinate from one axis length to another.
     *
     * @param value - The coordinate.
     * @param from - Length of the axis {@code value} is expressed in.
     * @param to - Length of the target axis.
     * @return The scaled coordinate, clamped to the target axis.
     */
    private static int scale(int value, int from, int to) {
        if (from <= 0) {
            return 0;
        }

        int scaled = (value * to) / from;

        return scaled < 0 ? 0 : Math.min(scaled, to - 1);
    }

    /**
     * Rounds a frame rotation to one of 0, 90, 180 or 270.
     *
     * @param rotation - The rotation, in degrees.
     * @return The normalized rotation.
     */
    private static int normalizeRotation(int rotation) {
        int normalized = ((rotation % 360) + 360) % 360;

        return (normalized / 90) * 90;
    }

    /**
     * Keeps a blur radius small enough that the running sum window stays meaningful for the plane
     * it is applied to.
     *
     * @param radius - The desired radius, in pixels.
     * @param planeWidth - Width of the plane.
     * @param planeHeight - Height of the plane.
     * @return The clamped radius.
     */
    private static int clampRadius(int radius, int planeWidth, int planeHeight) {
        int limit = Math.max(1, (Math.min(planeWidth, planeHeight) - 1) / 2);

        return Math.max(1, Math.min(radius, limit));
    }

    /**
     * Two iterations of a separable box blur, which approximates a Gaussian closely enough for a
     * background and costs the same regardless of radius thanks to the running sum.
     *
     * @param source - The plane to blur.
     * @param destination - Receives the blurred plane.
     * @param scratch - Scratch space the size of the plane.
     * @param planeWidth - Width of the plane.
     * @param planeHeight - Height of the plane.
     * @param radius - Blur radius, in pixels.
     */
    private static void boxBlur(byte[] source, byte[] destination, byte[] scratch, int planeWidth,
            int planeHeight, int radius) {
        byte[] input = source;

        for (int iteration = 0; iteration < 2; iteration++) {
            blurHorizontally(input, scratch, planeWidth, planeHeight, radius);
            blurVertically(scratch, destination, planeWidth, planeHeight, radius);
            input = destination;
        }
    }

    private static void blurHorizontally(byte[] source, byte[] destination, int planeWidth,
            int planeHeight, int radius) {
        int window = (radius * 2) + 1;

        for (int y = 0; y < planeHeight; y++) {
            int row = y * planeWidth;
            int sum = 0;

            for (int x = -radius; x <= radius; x++) {
                sum += source[row + clamp(x, planeWidth)] & 0xff;
            }

            for (int x = 0; x < planeWidth; x++) {
                destination[row + x] = (byte) (sum / window);
                sum += (source[row + clamp(x + radius + 1, planeWidth)] & 0xff)
                    - (source[row + clamp(x - radius, planeWidth)] & 0xff);
            }
        }
    }

    private static void blurVertically(byte[] source, byte[] destination, int planeWidth,
            int planeHeight, int radius) {
        int window = (radius * 2) + 1;

        for (int x = 0; x < planeWidth; x++) {
            int sum = 0;

            for (int y = -radius; y <= radius; y++) {
                sum += source[(clamp(y, planeHeight) * planeWidth) + x] & 0xff;
            }

            for (int y = 0; y < planeHeight; y++) {
                destination[(y * planeWidth) + x] = (byte) (sum / window);
                sum += (source[(clamp(y + radius + 1, planeHeight) * planeWidth) + x] & 0xff)
                    - (source[(clamp(y - radius, planeHeight) * planeWidth) + x] & 0xff);
            }
        }
    }

    private static int clamp(int value, int length) {
        if (value < 0) {
            return 0;
        }

        return Math.min(value, length - 1);
    }

    /**
     * Copies a possibly strided plane into a packed byte array.
     *
     * @param buffer - The source plane.
     * @param stride - Row stride of the source plane.
     * @param destination - Receives the packed plane.
     * @param planeWidth - Width of the plane.
     * @param planeHeight - Height of the plane.
     */
    private static void readPlane(ByteBuffer buffer, int stride, byte[] destination, int planeWidth,
            int planeHeight) {
        if (stride == planeWidth) {
            buffer.position(0);
            buffer.get(destination, 0, planeWidth * planeHeight);

            return;
        }

        for (int y = 0; y < planeHeight; y++) {
            buffer.position(y * stride);
            buffer.get(destination, y * planeWidth, planeWidth);
        }
    }

    /**
     * Copies a packed byte array into a possibly strided plane.
     *
     * @param buffer - The destination plane.
     * @param stride - Row stride of the destination plane.
     * @param source - The packed plane.
     * @param planeWidth - Width of the plane.
     * @param planeHeight - Height of the plane.
     */
    private static void writePlane(ByteBuffer buffer, int stride, byte[] source, int planeWidth,
            int planeHeight) {
        if (stride == planeWidth) {
            buffer.position(0);
            buffer.put(source, 0, planeWidth * planeHeight);
        } else {
            for (int y = 0; y < planeHeight; y++) {
                buffer.position(y * stride);
                buffer.put(source, y * planeWidth, planeWidth);
            }
        }

        buffer.rewind();
    }
}
