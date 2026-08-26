import { IReduxState, IStore } from '../../app/types';
import { MEDIA_TYPE } from '../../base/media/constants';
import {
    DEFAULT_VOLUME,
    PLAYBACK_DUCKED_VOLUME,
    TRANSLATION_DUCKED_VOLUME,
    VOLUME_RETRIES_MS
} from '../constants';
import { isS2SV2Active, shouldSuppressOriginalVoice } from '../functions';
import logger from '../logger';

/**
 * Who is being read out right now, so that their own voice is out of the way of the translation of it.
 *
 * Kept here rather than in redux because it changes on every sentence and nothing on screen is drawn from it: putting
 * it in the store would re-render the meeting once per utterance for no one's benefit.
 */
let speakingParticipantId: string | null = null;

/**
 * The volumes still to be set a second and a third time, held so that a session which has ended can drop them.
 */
let retries: Array<ReturnType<typeof setTimeout>> = [];

/**
 * Returns how loud one participant should be heard right now.
 *
 * Two rules, both decided by the local listener alone and neither of them announced to anybody:
 *
 * - While this device is reading somebody's translation out, that participant is silent. Their voice and the
 *   translation of it are the same sentence twice, and hearing both is harder than hearing either.
 * - Otherwise, whether they are a murmur or at full volume is the listener's standing preference. Turned on, it holds
 *   for the whole session rather than only while something is being read out: a voice which drops and rises around
 *   every sentence is more distracting than one which stays quiet.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} participantId - Who is being asked about.
 * @returns {number}
 */
function _volumeFor(state: IReduxState, participantId?: string): number {
    if (participantId && participantId === speakingParticipantId) {
        return PLAYBACK_DUCKED_VOLUME;
    }

    return shouldSuppressOriginalVoice(state) ? TRANSLATION_DUCKED_VOLUME : DEFAULT_VOLUME;
}

/**
 * Sets how loud one remote participant is heard.
 *
 * @param {IReduxState} state - The redux state.
 * @param {Object} jitsiTrack - The track to set the volume of. Anything which is not somebody else's audio is ignored,
 * so callers can hand over whichever track an action happened to carry.
 * @param {boolean} ducked - Whether a session is running. When it is not, everybody goes back to full volume.
 * @returns {boolean} Whether a volume was actually set.
 */
export function duckTrack(state: IReduxState, jitsiTrack: any, ducked: boolean): boolean {
    if (!jitsiTrack || jitsiTrack.isLocal?.() || jitsiTrack.getType?.() !== MEDIA_TYPE.AUDIO) {
        return false;
    }

    const participantId = jitsiTrack.getParticipantId?.();
    const volume = ducked ? _volumeFor(state, participantId) : DEFAULT_VOLUME;

    // The volume of one remote track, which react-native-webrtc adds to the standard track. There is no audio element
    // to set a volume on the way the web client has, and the all-or-nothing switch the captions use cannot express a
    // murmur, so this is the only mechanism which can do what the contract asks for.
    const track = jitsiTrack.track;

    if (typeof track?._setVolume !== 'function') {
        logger.warn(`No volume to set on the audio of ${participantId}`);

        return false;
    }

    try {
        track._setVolume(volume);
    } catch (error) {
        logger.warn(`Could not change how loud ${participantId} is heard`, error);

        return false;
    }

    return true;
}

/**
 * Sets how loud everybody currently in the meeting is heard.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} ducked - Whether a session is running.
 * @returns {void}
 */
export function duckAll({ getState }: IStore, ducked: boolean) {
    const state = getState();

    state['features/base/tracks'].forEach(track => duckTrack(state, track.jitsiTrack, ducked));
}

/**
 * Sets everybody's volume again shortly, and once more after that.
 *
 * A track which has only just been added is not playing yet, and a volume set on an audio sink the engine has not
 * created is dropped rather than kept for when it has. Asking again once the participant is actually being heard is
 * what makes it stick.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
export function duckAgainShortly(store: IStore) {
    cancelVolumeRetries();

    retries = VOLUME_RETRIES_MS.map(delay => setTimeout(() => {
        if (isS2SV2Active(store.getState())) {
            duckAll(store, true);
        }
    }, delay));
}

/**
 * Drops the pending attempts, so that a session which has ended cannot turn somebody down after the fact.
 *
 * @returns {void}
 */
export function cancelVolumeRetries() {
    retries.forEach(retry => clearTimeout(retry));
    retries = [];
}

/**
 * Records who is being read out and puts the volumes where that leaves them.
 *
 * @param {IStore} store - The redux store.
 * @param {string} participantId - Who, or nobody.
 * @returns {void}
 */
export function setSpeakingParticipant(store: IStore, participantId: string | null) {
    if (speakingParticipantId === participantId) {
        return;
    }

    const previous = speakingParticipantId;

    speakingParticipantId = participantId;

    const state = store.getState();
    const active = isS2SV2Active(state);
    const tracks = state['features/base/tracks'];

    // Only the two participants whose volume can have changed, rather than everybody: a room of twenty does not need
    // twenty volume calls per sentence. A speaker who has left in the meantime simply has no track to find, which is
    // the whole of what "skip the duck for an absent track" comes to.
    [ previous, participantId ].forEach(id => {
        if (!id) {
            return;
        }

        const track = tracks.find(candidate =>
            candidate.jitsiTrack?.getParticipantId?.() === id
            && candidate.jitsiTrack?.getType?.() === MEDIA_TYPE.AUDIO);

        if (track) {
            duckTrack(state, track.jitsiTrack, active);
        }
    });
}

/**
 * Forgets who was being read out, for when a session ends.
 *
 * @returns {void}
 */
export function resetSpeakingParticipant() {
    speakingParticipantId = null;
}
