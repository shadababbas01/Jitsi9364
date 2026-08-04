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

import java.io.ByteArrayOutputStream;

/**
 * Turns the raw microphone samples which {@link LocalAudioTap} collects into a
 * WAV file the transcription service accepts.
 *
 * WebRTC hands over 48 kHz audio, which is four times the bandwidth a speech
 * recognizer uses and four times the bytes to upload, so the samples are
 * resampled down to {@link #TARGET_SAMPLE_RATE} first. The resampler averages
 * every input sample which falls inside an output sample's span rather than
 * picking one of them: dropping samples outright would fold the energy above
 * the new Nyquist frequency back into the speech band and audibly roughen the
 * consonants, which is exactly what a recognizer trips over.
 *
 * WAV is used rather than a compressed container because it needs no encoder,
 * cannot fail, and adds no latency. It does cost about 32 kB per second of
 * speech on the wire; see the class comment of {@link LocalAudioTap} for why
 * that is acceptable and what to do if it stops being so.
 */
final class AudioChunkEncoder {
    /**
     * The sample rate the audio is resampled to. Speech recognizers are trained
     * at 16 kHz and gain nothing from more.
     */
    static final int TARGET_SAMPLE_RATE = 16000;

    /**
     * The size of the RIFF header which precedes the samples in a WAV file.
     */
    private static final int WAV_HEADER_SIZE = 44;

    private static final int BITS_PER_SAMPLE = 16;

    private AudioChunkEncoder() {
    }

    /**
     * Wraps 16 bit PCM samples in a WAV file, resampling and downmixing them to
     * mono at {@link #TARGET_SAMPLE_RATE} on the way.
     *
     * @param pcm little endian 16 bit PCM samples, channels interleaved
     * @param length how many bytes of {@code pcm} hold samples
     * @param sampleRate the rate {@code pcm} was captured at
     * @param channelCount how many channels {@code pcm} interleaves
     * @return a complete WAV file
     */
    static byte[] toWav(byte[] pcm, int length, int sampleRate, int channelCount) {
        short[] mono = toMono(pcm, length, channelCount);
        short[] resampled = resample(mono, sampleRate, TARGET_SAMPLE_RATE);

        ByteArrayOutputStream out
            = new ByteArrayOutputStream(WAV_HEADER_SIZE + (resampled.length * 2));

        writeHeader(out, resampled.length);

        for (short sample : resampled) {
            out.write(sample & 0xff);
            out.write((sample >> 8) & 0xff);
        }

        return out.toByteArray();
    }

    /**
     * Reads interleaved little endian 16 bit samples into a mono signal,
     * averaging the channels when there is more than one.
     *
     * @param pcm the interleaved samples
     * @param length how many bytes of {@code pcm} hold samples
     * @param channelCount how many channels {@code pcm} interleaves
     * @return the mono signal
     */
    private static short[] toMono(byte[] pcm, int length, int channelCount) {
        int channels = Math.max(1, channelCount);
        int frames = length / (2 * channels);
        short[] mono = new short[frames];

        for (int frame = 0; frame < frames; frame++) {
            int sum = 0;

            for (int channel = 0; channel < channels; channel++) {
                int index = ((frame * channels) + channel) * 2;

                sum += (short) ((pcm[index] & 0xff) | (pcm[index + 1] << 8));
            }

            mono[frame] = (short) (sum / channels);
        }

        return mono;
    }

    /**
     * Resamples a mono signal by averaging the input samples which fall inside
     * each output sample's span. See the class comment for why the input is not
     * simply decimated.
     *
     * @param input the mono signal
     * @param fromRate the rate {@code input} is sampled at
     * @param toRate the rate to resample to
     * @return the resampled signal, or {@code input} itself when the rates match
     */
    private static short[] resample(short[] input, int fromRate, int toRate) {
        if (fromRate == toRate || input.length == 0 || fromRate <= 0) {
            return input;
        }

        int outputLength = (int) (((long) input.length * toRate) / fromRate);

        if (outputLength <= 0) {
            return new short[0];
        }

        short[] output = new short[outputLength];
        double span = (double) input.length / outputLength;

        for (int i = 0; i < outputLength; i++) {
            int start = (int) (i * span);
            int end = Math.min(input.length, Math.max(start + 1, (int) ((i + 1) * span)));
            long sum = 0;

            for (int j = start; j < end; j++) {
                sum += input[j];
            }

            output[i] = (short) (sum / (end - start));
        }

        return output;
    }

    /**
     * Writes the RIFF header of a mono 16 bit WAV file.
     *
     * @param out where to write it
     * @param sampleCount how many samples follow the header
     */
    private static void writeHeader(ByteArrayOutputStream out, int sampleCount) {
        int dataSize = sampleCount * 2;
        int byteRate = TARGET_SAMPLE_RATE * (BITS_PER_SAMPLE / 8);

        writeAscii(out, "RIFF");
        writeInt(out, 36 + dataSize);
        writeAscii(out, "WAVE");
        writeAscii(out, "fmt ");
        writeInt(out, 16);
        writeShort(out, 1);
        writeShort(out, 1);
        writeInt(out, TARGET_SAMPLE_RATE);
        writeInt(out, byteRate);
        writeShort(out, BITS_PER_SAMPLE / 8);
        writeShort(out, BITS_PER_SAMPLE);
        writeAscii(out, "data");
        writeInt(out, dataSize);
    }

    private static void writeAscii(ByteArrayOutputStream out, String value) {
        for (int i = 0; i < value.length(); i++) {
            out.write(value.charAt(i));
        }
    }

    private static void writeInt(ByteArrayOutputStream out, int value) {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
        out.write((value >> 16) & 0xff);
        out.write((value >> 24) & 0xff);
    }

    private static void writeShort(ByteArrayOutputStream out, int value) {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
    }
}
