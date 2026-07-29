import { IReduxState } from '../../app/types';
import { MEDIA_TYPE } from '../../base/media/constants';
import { ITrack } from '../../base/tracks/types';
import logger from '../logger';

/**
 * Whether the remote audio is currently silenced by this module.
 */
let silenced = false;

/**
 * Enables or disables playback of a single remote audio track.
 *
 * On mobile there is no audio element to mute: react-native-webrtc plays remote audio itself as soon as the track
 * arrives. Disabling the underlying MediaStreamTrack makes it produce silence locally, which leaves the transcriber
 * untouched - it receives its own copy of the audio from the bridge - so captions keep coming in while nothing is heard.
 *
 * @param {ITrack} track - The redux representation of the remote track.
 * @param {boolean} enabled - Whether the track should be audible.
 * @returns {void}
 */
function _setTrackEnabled(track: ITrack, enabled: boolean) {
    try {
        const stream = track.jitsiTrack?.getOriginalStream?.();

        for (const mediaStreamTrack of stream?.getAudioTracks?.() ?? []) {
            mediaStreamTrack.enabled = enabled;
        }
    } catch (error) {
        logger.warn('Failed to change the audibility of a remote audio track', error);
    }
}

/**
 * Returns the remote audio tracks of a conference.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {ITrack[]}
 */
function _getRemoteAudioTracks(state: IReduxState): ITrack[] {
    return state['features/base/tracks']
        .filter(track => !track.local && track.mediaType === MEDIA_TYPE.AUDIO);
}

/**
 * Silences or restores the voices of the remote participants.
 *
 * @param {IReduxState} state - The redux state.
 * @param {boolean} shouldSilence - Whether the remote participants should be inaudible.
 * @returns {void}
 */
export function setRemoteAudioSilenced(state: IReduxState, shouldSilence: boolean) {
    if (silenced === shouldSilence) {
        return;
    }

    silenced = shouldSilence;

    for (const track of _getRemoteAudioTracks(state)) {
        _setTrackEnabled(track, !shouldSilence);
    }

    logger.info(`Remote audio ${shouldSilence ? 'silenced' : 'restored'} for caption read aloud`);
}

/**
 * Silences a remote audio track which arrived while the remote voices are muted, so a participant who joins or unmutes
 * mid-meeting does not become audible.
 *
 * @param {ITrack} track - The track which was just added.
 * @returns {void}
 */
export function silenceNewRemoteAudioTrack(track?: ITrack) {
    if (!silenced || !track || track.local || track.mediaType !== MEDIA_TYPE.AUDIO) {
        return;
    }

    _setTrackEnabled(track, false);
}

/**
 * Returns whether the remote voices are currently silenced.
 *
 * @returns {boolean}
 */
export function isRemoteAudioSilenced(): boolean {
    return silenced;
}

/**
 * Forgets that the remote audio was silenced, without touching any track. To be used when the conference is over and
 * its tracks are gone.
 *
 * @returns {void}
 */
export function resetRemoteAudioSilenced() {
    silenced = false;
}
