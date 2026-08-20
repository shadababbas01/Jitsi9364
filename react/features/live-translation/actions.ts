import {
    SET_LIVE_TRANSLATION_ACTIVE,
    SET_LIVE_TRANSLATION_DICTATING,
    SET_LIVE_TRANSLATION_ERROR,
    SET_LIVE_TRANSLATION_MIC,
    SET_LIVE_TRANSLATION_PENDING,
    SET_LIVE_TRANSLATION_UNTRANSLATED
} from './actionTypes';

/**
 * Turns the live translation call on or off.
 *
 * @param {boolean} active - Whether the call is on.
 * @param {boolean} broadcast - Whether the rest of the meeting is asked to join, or told the asking is over. False for
 * a call which is being turned on in answer to somebody else's invitation, which would otherwise invite them back.
 * @returns {Object}
 */
export function setLiveTranslationActive(active: boolean, broadcast = true) {
    return {
        type: SET_LIVE_TRANSLATION_ACTIVE,
        active,
        broadcast
    };
}

/**
 * Opens or closes the microphone the live translation call listens through.
 *
 * @param {boolean} micOn - Whether the microphone is open.
 * @returns {Object}
 */
export function setLiveTranslationMic(micOn: boolean) {
    return {
        type: SET_LIVE_TRANSLATION_MIC,
        micOn
    };
}

/**
 * Records whether the recorder is hearing the local participant right now.
 *
 * @param {boolean} dictating - Whether the local participant is speaking.
 * @returns {Object}
 */
export function setLiveTranslationDictating(dictating: boolean) {
    return {
        type: SET_LIVE_TRANSLATION_DICTATING,
        dictating
    };
}

/**
 * Records how many utterances are being transcribed and sent.
 *
 * @param {number} pending - The number of utterances in flight.
 * @returns {Object}
 */
export function setLiveTranslationPending(pending: number) {
    return {
        type: SET_LIVE_TRANSLATION_PENDING,
        pending
    };
}

/**
 * Records that something went wrong, or clears it.
 *
 * @param {string | null} error - The key of the message to show, if any.
 * @returns {Object}
 */
export function setLiveTranslationError(error: string | null) {
    return {
        type: SET_LIVE_TRANSLATION_ERROR,
        error
    };
}

/**
 * Records whether one participant is to be heard in their own voice rather than read out in translation.
 *
 * The choice is the local user's alone and is never announced: everybody decides for themselves whose voice they
 * understand, and somebody who speaks the language does not need a translation of it read over the top.
 *
 * @param {string} participantId - The participant this is about.
 * @param {boolean} untranslated - Whether to hear them untranslated.
 * @returns {Object}
 */
export function setLiveTranslationUntranslated(participantId: string, untranslated: boolean) {
    return {
        type: SET_LIVE_TRANSLATION_UNTRANSLATED,
        participantId,
        untranslated
    };
}
