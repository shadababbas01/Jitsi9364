import { NativeModules } from 'react-native';
import Sound from 'react-native-sound';

import logger from '../../logger';

interface IPiperAudioFileModule {
    remove: (path: string) => Promise<null>;
    write: (base64: string, extension: string) => Promise<string>;
}

const { PiperAudioFile } = NativeModules as { PiperAudioFile?: IPiperAudioFileModule; };

/**
 * Deletes a temporary audio file this player wrote, without letting a cleanup failure become anyone else's problem -
 * a file this device could not remove is the OS's to reclaim from its own cache eventually regardless.
 *
 * @param {string} path - The file to delete.
 * @returns {void}
 */
function removeQuietly(path: string) {
    PiperAudioFile?.remove(path).catch(error => logger.warn('Could not remove a temporary audio file', error));
}

/**
 * Plays one decoded Piper clip at a time.
 *
 * The Android build of react-native-sound this app ships has no support for a "data:" URI - its native player only
 * knows how to open a bundled resource, an http(s)/asset/file URL, or a real file already on disk - so a clip is
 * written to a temporary file via {@link PiperAudioFileModule} before anything is asked to play it, the same way
 * {@code CaptionsTtsModule.synthesizeToFile} and the audio-extraction feature's own recorded clips already reach
 * this same player as real files rather than in-memory audio.
 *
 * A translated sentence is always read out in the middle of a call, and a call has already put the device into
 * {@code MODE_IN_COMMUNICATION} and taken exclusive audio focus for {@code STREAM_VOICE_CALL} (see
 * {@code AudioDeviceHandlerGeneric.setMode}) for as long as it runs. The Android build of react-native-sound this
 * app ships puts a clip on {@code STREAM_MUSIC} unless told otherwise, and a {@code STREAM_MUSIC} player started
 * while the device holds the call's focus on {@code STREAM_VOICE_CALL} is not routed the same way the call audio
 * is - on a real device it is inaudible rather than merely quiet, which is indistinguishable from this class doing
 * nothing at all. {@link play} asks for the "Voice" category before every clip so that it shares the call's own
 * stream instead of a second, uncoordinated one.
 */
export default class PiperAudioPlayer {
    private _current: Sound | null = null;

    private _currentPath: string | null = null;

    /**
     * Settles whichever {@link play} promise is currently outstanding. The underlying player's own {@code stop()}
     * does not run the completion callback {@link play} is waiting on - nothing about a deliberate stop is the clip
     * reaching its end - so without this, stopping a clip mid-playback would leave its caller waiting forever.
     */
    private _settleCurrent: (() => void) | null = null;

    /**
     * Stops whatever this player is playing, releasing it, removing its temporary file, and letting whatever was
     * waiting on it carry on rather than waiting forever.
     *
     * @returns {void}
     */
    stop(): void {
        const sound = this._current;
        const path = this._currentPath;
        const settle = this._settleCurrent;

        this._current = null;
        this._currentPath = null;
        this._settleCurrent = null;

        if (sound) {
            sound.stop(() => sound.release());
        }

        if (path) {
            removeQuietly(path);
        }

        settle?.();
    }

    /**
     * Plays one clip, replacing whatever this player was playing before it.
     *
     * @param {string} bytes - The audio, base64 encoded.
     * @param {string} format - What it is encoded as, e.g. "wav".
     * @returns {Promise<void>} Resolved once playback has finished; rejected if it could not be written, loaded, or
     * played.
     */
    async play(bytes: string, format: string): Promise<void> {
        this.stop();

        if (!PiperAudioFile) {
            throw new Error('This device has no writer for synthesized audio');
        }

        let path: string;

        try {
            path = await PiperAudioFile.write(bytes, format || 'wav');
            console.log(`[s2s-v2] Piper: wrote a synthesized clip to a temporary file (${bytes.length} `
                + 'base64 chars written)');
        } catch (error) {
            logger.warn('Could not write a synthesized clip to a temporary file', error);
            console.warn('[s2s-v2] Piper: could not write a synthesized clip to a temporary file', error);
            throw new Error('Could not write the synthesized audio to a file');
        }

        // Must be set before the player is created - react-native-sound applies the stream type while preparing it,
        // not afterwards, so asking on an already-loaded clip would be too late to change anything about it.
        //
        // "Voice" is not in the package's own type declarations - they list only the iOS AVAudioSessionCategory
        // values - but it is an Android category this build's native module (RNSoundModule.java) does understand,
        // and the only one of them which maps to STREAM_VOICE_CALL.
        (Sound.setCategory as (category: string) => void)('Voice');

        return new Promise<void>((resolve, reject) => {
            const sound = new Sound(path, '', error => {
                if (error) {
                    logger.warn('Could not load a synthesized clip', error);
                    console.warn('[s2s-v2] Piper: could not load a synthesized clip', error);
                    sound.release();
                    removeQuietly(path);

                    if (this._current === sound) {
                        this._current = null;
                        this._currentPath = null;
                    }

                    reject(new Error('Could not load the synthesized audio'));

                    return;
                }

                console.log(`[s2s-v2] Piper: loaded a synthesized clip (${sound.getDuration()}s); playing`);

                this._current = sound;
                this._currentPath = path;
                this._settleCurrent = () => resolve();

                sound.play(success => {
                    sound.release();
                    removeQuietly(path);

                    if (this._current === sound) {
                        this._current = null;
                        this._currentPath = null;
                        this._settleCurrent = null;
                    }

                    console.log(`[s2s-v2] Piper: clip playback finished (success: ${success})`);

                    if (success) {
                        resolve();
                    } else {
                        reject(new Error('Could not play the synthesized audio'));
                    }
                });
            });
        });
    }
}
