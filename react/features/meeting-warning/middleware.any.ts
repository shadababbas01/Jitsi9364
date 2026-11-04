import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { isJwtAccessFeatureBlocked } from '../base/jwt/functions';
import { isLocalParticipantModerator } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SET_S2S_V2_LANGUAGE_POPUP, SET_S2S_V2_PANEL, START_S2S_V2_SESSION } from '../s2s-v2/actionTypes';
import { isS2SV2Active } from '../s2s-v2/functions';
import { SET_REQUESTING_SUBTITLES, TOGGLE_REQUESTING_SUBTITLES } from '../subtitles/actionTypes';
import { ENABLE_VOICE_TRANSLATION } from '../voice-translation/actionTypes';
import { disableVoiceTranslation } from '../voice-translation/actions';
import { isVoiceTranslationEnabled } from '../voice-translation/functions';
import { SET_WHITEBOARD_OPEN } from '../whiteboard/actionTypes';

import {
    TrackedFeature,
    checkFeatureAccess,
    checkFeatureUsage,
    getFeatureLimit,
    getQuotaStatus,
    softAlertForUse,
    toPositiveInt
} from './functions';

/**
 * Plan capping for the features a user can reach on Android whose start goes through a redux action, ported from the
 * web client. Features with no native entry point (local recording, noise suppression, AI summary, evaluation mode)
 * have no case here. Poll creation, server recording, breakout rooms and Melp Pad are gated where they start
 * (AbstractPollsPane, AbstractPollCreate, the recording actions and dialog, createBreakoutRoom and
 * SharedDocumentButton), because on native none of them goes through an action this middleware sees.
 *
 * This middleware has to see an action before the feature's own middleware does, which is why it is the first
 * import in app/middlewares.native.ts.
 */

/**
 * Lets a quota-tracked action through unless its quota is used up or not in the plan, then shows the soft alert when
 * the use reaches the alert threshold or the last unit. Returns undefined when the action was blocked. Nothing is
 * counted locally: these features are counted by the server.
 *
 * @param {IStore} store - The redux store.
 * @param {TrackedFeature} feature - The feature key.
 * @param {Function} runAction - Passes the action on.
 * @param {boolean} showPostLimitAlert - Whether the last-unit alert applies.
 * @returns {any}
 */
function _consumeFeatureUsage(store: IStore, feature: TrackedFeature, runAction: () => any, showPostLimitAlert = true) {
    const featureLimit = getFeatureLimit(store.getState(), feature);

    if (!featureLimit) {
        return runAction();
    }

    if (!store.dispatch(checkFeatureUsage(feature))) {
        return undefined;
    }

    const result = runAction();

    store.dispatch(softAlertForUse(feature, toPositiveInt(featureLimit.used), toPositiveInt(featureLimit.limit),
        toPositiveInt(featureLimit.alertlimit), showPostLimitAlert));

    return result;
}

/**
 * Gates a local moderator turning live captions on. Turning them off, a sync from somebody else's session and a
 * non-moderator's attempt (which the captions session middleware refuses on its own) all pass through.
 *
 * @param {IStore} store - The redux store.
 * @param {Function} next - The next middleware.
 * @param {AnyAction} action - The captions action.
 * @param {boolean} enablingNow - Whether the action turns captions on.
 * @returns {any}
 */
function _gateCaptionsEnable(store: IStore, next: Function, action: AnyAction, enablingNow: boolean) {
    const state = store.getState();

    if (!enablingNow || action.fromRemoteSync || !isLocalParticipantModerator(state)) {
        return next(action);
    }

    const featureLimit = getFeatureLimit(state, 'transcription');

    // Transcription is the one quota whose `enabled` flag also counts, as on web. A quota the issuer disabled is
    // refused without a popup of its own - web's equivalent is the silent guard before it broadcasts the
    // transcription property - so that nobody else in the room is told captions are starting. The used-up and
    // not-in-the-plan cases still get their popup from _consumeFeatureUsage.
    const result = featureLimit?.enabled === false && getQuotaStatus(featureLimit) === 'ok'
        ? undefined
        : _consumeFeatureUsage(store, 'transcription', () => next(action));

    // Blocked - voice translation would have been driving these captions, so it cannot stay on either.
    if (result === undefined && isVoiceTranslationEnabled(state)) {
        store.dispatch(disableVoiceTranslation({ broadcast: true }));
    }

    return result;
}

MiddlewareRegistry.register(store => next => action => {
    const state = store.getState();

    switch (action.type) {
    case SET_WHITEBOARD_OPEN:
        if (Boolean(action.isOpen) && isJwtAccessFeatureBlocked(state, 'whiteboard')) {
            // As on web: a moderator is told; a participant's whiteboard just closes.
            if (isLocalParticipantModerator(state)) {
                store.dispatch(checkFeatureAccess('whiteboard'));
                store.dispatch({
                    type: SET_WHITEBOARD_OPEN,
                    isOpen: false
                });
            }

            return undefined;
        }

        return next(action);

    case ENABLE_VOICE_TRANSLATION:
        // Only the initiating moderator consumes quota - remote enables (broadcast === false, dispatched on an
        // endpoint message) pass through. Counted by the server, so nothing is incremented here.
        if (!action.broadcast || !isLocalParticipantModerator(state)) {
            return next(action);
        }

        return _consumeFeatureUsage(store, 'speech_to_speech', () => next(action));

    case START_S2S_V2_SESSION:
        // Only a local start emits this - a session somebody else started arrives as SET_S2S_V2_SESSION - and the
        // s2s-v2 middleware refuses a non-moderator's start by itself. Counted by the server.
        if (!isLocalParticipantModerator(state)) {
            return next(action);
        }

        return _consumeFeatureUsage(store, 'speech_to_speech', () => next(action));

    case SET_S2S_V2_LANGUAGE_POPUP:
    case SET_S2S_V2_PANEL:
        // The translation buttons ask for a session and then open the language sheet or the panel straight after. A
        // start the plan refused leaves no session, and the limit popup must not have translation UI opening behind
        // it: nothing to pick a language for or to read until a session is running.
        if (action.visible && !isS2SV2Active(state)) {
            return undefined;
        }

        return next(action);

    case TOGGLE_REQUESTING_SUBTITLES:
        return _gateCaptionsEnable(store, next, action, !state['features/subtitles']?._requestingSubtitles);

    case SET_REQUESTING_SUBTITLES:
        return _gateCaptionsEnable(
            store, next, action, Boolean(action.enabled) && !state['features/subtitles']?._requestingSubtitles);
    }

    return next(action);
});
