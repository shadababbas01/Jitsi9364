import { IStore } from '../../app/types';
import JitsiMeetJS from '../../base/lib-jitsi-meet/_';
import { MEDIA_TYPE } from '../../base/media/constants';
import { setS2SV2MultipleSpeakers } from '../actions';
import { SPEAKING_HANGOVER_MS, SPEAKING_LEVEL_THRESHOLD } from '../constants';
import { getS2SV2State } from '../functions';
import logger from '../logger';

/**
 * The event a track reports how loud it is on.
 */
const { TRACK_AUDIO_LEVEL_CHANGED } = JitsiMeetJS.events.track;

/**
 * The listeners on the remote tracks, held so that they can all be taken off again.
 */
const listeners = new Map<any, (level: number) => void>();

/**
 * Who is talking right now, and when they were last heard.
 */
const speaking = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Works out whether more than one person is talking and records it if the answer has changed.
 *
 * Nothing is sent about this. Every device reads the same audio levels off the same tracks, so every device arrives at
 * the same answer on its own, and a message saying so would be a message which could disagree with what the listener
 * can plainly hear.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _evaluate(store: IStore) {
    const detected = speaking.size > 1;

    // Only when it actually flips. The levels arrive many times a second and dispatching on each of them would re-render
    // the meeting for the length of every sentence.
    if (getS2SV2State(store.getState()).multipleSpeakersDetected !== detected) {
        store.dispatch(setS2SV2MultipleSpeakers(detected));
    }
}

/**
 * Records that a participant was heard, and arranges for them to stop counting as talking once they have been quiet
 * for long enough.
 *
 * The pause between two words is not the end of a sentence, which is what the hangover is for: without it the
 * indicator flickers all the way through anybody talking.
 *
 * @param {IStore} store - The redux store.
 * @param {string} participantId - Who was heard.
 * @returns {void}
 */
function _heard(store: IStore, participantId: string) {
    clearTimeout(speaking.get(participantId) as ReturnType<typeof setTimeout>);

    speaking.set(participantId, setTimeout(() => {
        speaking.delete(participantId);
        _evaluate(store);
    }, SPEAKING_HANGOVER_MS));

    _evaluate(store);
}

/**
 * Listens to one remote audio track, if it is one and is not already being listened to.
 *
 * @param {IStore} store - The redux store.
 * @param {Object} jitsiTrack - The track to listen to.
 * @returns {void}
 */
export function watchTrack(store: IStore, jitsiTrack: any) {
    if (!jitsiTrack
            || jitsiTrack.isLocal?.()
            || jitsiTrack.getType?.() !== MEDIA_TYPE.AUDIO
            || listeners.has(jitsiTrack)) {
        return;
    }

    const participantId = jitsiTrack.getParticipantId?.();

    if (!participantId) {
        return;
    }

    const listener = (level: number) => {
        if (level > SPEAKING_LEVEL_THRESHOLD) {
            _heard(store, participantId);
        }
    };

    try {
        jitsiTrack.on(TRACK_AUDIO_LEVEL_CHANGED, listener);
        listeners.set(jitsiTrack, listener);
    } catch (error) {
        logger.warn(`Could not listen to how loud ${participantId} is`, error);
    }
}

/**
 * Stops listening to one track, for when it goes away.
 *
 * @param {IStore} store - The redux store.
 * @param {Object} jitsiTrack - The track to stop listening to.
 * @returns {void}
 */
export function unwatchTrack(store: IStore, jitsiTrack: any) {
    const listener = listeners.get(jitsiTrack);

    if (!listener) {
        return;
    }

    try {
        jitsiTrack.off?.(TRACK_AUDIO_LEVEL_CHANGED, listener);
    } catch (error) {
        logger.warn('Could not stop listening to a track', error);
    }

    listeners.delete(jitsiTrack);

    const participantId = jitsiTrack.getParticipantId?.();

    if (participantId && speaking.has(participantId)) {
        clearTimeout(speaking.get(participantId) as ReturnType<typeof setTimeout>);
        speaking.delete(participantId);
        _evaluate(store);
    }
}

/**
 * Listens to every remote audio track currently in the meeting.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
export function watchAll(store: IStore) {
    store.getState()['features/base/tracks'].forEach(track => watchTrack(store, track.jitsiTrack));
}

/**
 * Stops listening to everything and forgets who was talking, for when a session ends.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
export function unwatchAll(store: IStore) {
    Array.from(listeners.keys()).forEach(jitsiTrack => unwatchTrack(store, jitsiTrack));

    speaking.forEach(timeout => clearTimeout(timeout));
    speaking.clear();
}
