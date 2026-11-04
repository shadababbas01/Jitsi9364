/**
 * Web shows the "Meeting ended" popup from its hangup flow and never holds a conference failure back.
 *
 * @param {Object} _action - The CONFERENCE_FAILED action.
 * @returns {Function}
 */
export function maybeDeferConferenceEnd(_action: Object) {
    return () => false;
}
