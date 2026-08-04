import { IReduxState } from '../../app/types';
import { MEDIA_TYPE } from '../media/constants';

import logger from './logger';
import { ITrack } from './types';

/**
 * The features currently asking for the remote participants to be inaudible. More than one can want it at the same time
 * - captions being read aloud and voice translation both replace the original voices - so the voices are only restored
 * once nobody is asking for them to be silenced any more.
 */
const silencingReasons = new Set<string>();

/**
 * Enables or disables playback of a single remote audio track.
 *
 * On mobile there is no audio element to mute: react-native-webrtc plays remote audio itself as soon as the track
 * arrives. Disabling the underlying MediaStreamTrack makes it produce silence locally, which is not signalled upstream,
 * so the transcriber keeps receiving its own copy of the audio from the bridge and captions keep coming in.
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
 * Returns whether the remote voices are currently silenced.
 *
 * @returns {boolean}
 */
export function isRemoteAudioSilenced(): boolean {
    return silencingReasons.size > 0;
}

/**
 * Silences or restores the voices of the remote participants on behalf of one feature.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} reason - Identifies the feature asking for this, so two features replacing the original audio cannot
 * restore each other's silence.
 * @param {boolean} shouldSilence - Whether that feature wants the remote participants to be inaudible.
 * @returns {void}
 */
export function setRemoteAudioSilenced(state: IReduxState, reason: string, shouldSilence: boolean) {
    const wasSilenced = isRemoteAudioSilenced();

    if (shouldSilence) {
        silencingReasons.add(reason);
    } else {
        silencingReasons.delete(reason);
    }

    const silenced = isRemoteAudioSilenced();

    if (silenced === wasSilenced) {
        return;
    }

    for (const track of _getRemoteAudioTracks(state)) {
        _setTrackEnabled(track, !silenced);
    }

    logger.info(`Remote audio ${silenced ? `silenced for ${reason}` : 'restored'}`);
}

/**
 * Silences a remote audio track which arrived while the remote voices are muted, so a participant who joins or unmutes
 * mid-meeting does not become audible.
 *
 * @param {ITrack} track - The track which was just added.
 * @returns {void}
 */
export function silenceNewRemoteAudioTrack(track?: ITrack) {
    if (!isRemoteAudioSilenced() || !track || track.local || track.mediaType !== MEDIA_TYPE.AUDIO) {
        return;
    }

    _setTrackEnabled(track, false);
}

/**
 * Forgets that the remote audio was silenced, without touching any track. To be used when the conference is over and its
 * tracks are gone.
 *
 * @returns {void}
 */
export function resetRemoteAudioSilenced() {
    silencingReasons.clear();
}
