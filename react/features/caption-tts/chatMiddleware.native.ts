import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { CONFERENCE_FAILED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { ADD_MESSAGE } from '../chat/actionTypes';
import { MESSAGE_TYPE_REMOTE } from '../chat/constants';

import { SPOKEN_CACHE_LIMIT } from './constants';
import { isCaptionTtsSupported, isChatTtsEnabled, toTtsLanguageTag } from './functions.native';
import CaptionsTtsQueue from './native/CaptionsTtsQueue';

/**
 * The queue feeding the device text-to-speech engine with chat messages. Deliberately separate from the one the captions
 * use: captions are flushed whenever the live transcript moves on, whereas a message which was sent has to be read out
 * whatever the captions are doing.
 */
let queue: CaptionsTtsQueue | undefined;

/**
 * The messages already handed to the queue, so that nothing is read out twice.
 */
const spokenMessageIds = new Set<string>();

/**
 * Whether this device can speak at all. Checked once, since the middleware sees every action.
 */
const supported = isCaptionTtsSupported();

/**
 * Middleware which reads chat messages from other participants aloud the moment they arrive, wherever in the app the
 * local user happens to be. It hooks the action which puts a message in the log rather than the chat UI, so a message
 * is spoken whether or not the chat is on screen.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    if (!supported) {
        return next(action);
    }

    switch (action.type) {
    case ADD_MESSAGE: {
        const result = next(action);

        _maybeSpeakMessage(store, action);

        return result;
    }

    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT:
        spokenMessageIds.clear();
        queue?.destroy();
        queue = undefined;
        break;
    }

    return next(action);
});

/**
 * Returns the speech queue, creating it if necessary.
 *
 * @param {IStore} store - The redux store.
 * @returns {CaptionsTtsQueue}
 */
function _getQueue(): CaptionsTtsQueue {
    if (!queue) {
        // Chat messages are not tied to a line in the captions UI, so nothing needs to know what is being spoken.
        queue = new CaptionsTtsQueue(() => { /* Nothing to reflect in the UI. */ });
    }

    return queue;
}

/**
 * Reads an incoming chat message aloud, if it came from somebody else and carries text.
 *
 * @param {IStore} store - The redux store.
 * @param {AnyAction} action - The {@code ADD_MESSAGE} action which was dispatched.
 * @returns {void}
 */
function _maybeSpeakMessage(store: IStore, action: AnyAction) {
    const text = typeof action.message === 'string' ? action.message.trim() : '';

    // Only what another participant typed or dictated: the local echo, reactions, shared files and the system's own
    // notices are not somebody talking to us.
    if (action.messageType !== MESSAGE_TYPE_REMOTE || action.isReaction || action.fileMetadata || !text) {
        return;
    }

    if (!isChatTtsEnabled(store.getState())) {
        return;
    }

    const messageId = action.messageId ?? `${action.participantId}-${action.timestamp}`;

    if (spokenMessageIds.has(messageId)) {
        return;
    }

    spokenMessageIds.add(messageId);

    // A long meeting must not turn this bookkeeping into a leak. Sets iterate in insertion order, so this drops the
    // oldest IDs, which are far too old to be re-added by anything.
    while (spokenMessageIds.size > SPOKEN_CACHE_LIMIT) {
        spokenMessageIds.delete(spokenMessageIds.values().next().value as string);
    }

    const speechQueue = _getQueue();

    speechQueue.setEnabled(true);
    speechQueue.enqueue({
        id: messageId,
        language: toTtsLanguageTag(store.getState()['features/subtitles']._language),
        text
    });
}
