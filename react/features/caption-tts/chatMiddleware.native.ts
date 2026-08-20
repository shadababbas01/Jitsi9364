import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { CONFERENCE_FAILED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { ADD_MESSAGE } from '../chat/actionTypes';
import { MESSAGE_TYPE_REMOTE } from '../chat/constants';
import { isParticipantUntranslated } from '../live-translation/functions.any';
import { translateLiveCaptionTextCached } from '../subtitles/languages';

import { setChatTtsSpeaker } from './actions';
import { SPOKEN_CACHE_LIMIT } from './constants';
import {
    getChatReadAloudLanguage,
    isCaptionTtsSupported,
    isChatTtsEnabled,
    toTtsLanguageTag
} from './functions.native';
import logger from './logger';
import CaptionsTtsQueue from './native/CaptionsTtsQueue';
import { clearSpokenText, rememberSpokenText } from './spokenText';

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
 * Who sent each message waiting to be, or being, read out. The queue only knows message IDs, and the UI needs to show
 * the participant it is speaking for.
 */
const messageSenders = new Map<string, string>();

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
        messageSenders.clear();
        clearSpokenText();
        queue?.destroy();
        queue = undefined;
        store.dispatch(setChatTtsSpeaker(null));
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
function _getQueue({ dispatch }: IStore): CaptionsTtsQueue {
    if (!queue) {
        queue = new CaptionsTtsQueue((speaking, messageId) => {
            const speakerId = speaking && messageId ? messageSenders.get(messageId) : undefined;

            dispatch(setChatTtsSpeaker(speakerId ?? null, speaking));
        });
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

    // Somebody the local user chose to hear in their own voice is not read out at all. Their audio is left at full
    // volume for exactly this reason, so speaking as well would put a translation on top of a voice which was already
    // understood.
    if (isParticipantUntranslated(store.getState(), action.participantId)) {
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

    if (action.participantId) {
        messageSenders.set(messageId, action.participantId);

        // The queue reports the end of an utterance without saying which one it was, so who sent what is pruned by age
        // rather than on the way out. Maps iterate in insertion order, so this drops the oldest entries.
        while (messageSenders.size > SPOKEN_CACHE_LIMIT) {
            messageSenders.delete(messageSenders.keys().next().value as string);
        }
    }

    const state = store.getState();
    const language = getChatReadAloudLanguage(state);
    const speechQueue = _getQueue(store);

    speechQueue.setEnabled(true);

    if (!language) {
        // No language was picked, so the message is spoken as it was received, in the voice of the caption language.
        rememberSpokenText(text);
        speechQueue.enqueue({
            id: messageId,
            language: toTtsLanguageTag(state['features/subtitles']._language),
            text
        });

        return;
    }

    // What the other participant sent has to be heard in the language the local user picked, so it is translated first.
    // The service detects the language it was written in on its own, which is why nothing here says what that was.
    translateLiveCaptionTextCached(`chat:${messageId}`, text, language, state['features/base/jwt'].jwt)
        .then(translated => {
            // What goes to the engine is what the microphone might hear back, so that is what has to be remembered.
            rememberSpokenText(translated || text);
            speechQueue.enqueue({
                id: messageId,
                language: toTtsLanguageTag(language),
                text: translated || text
            });
        })
        .catch(error => {
            logger.warn('Failed to translate a chat message before reading it aloud', error);

            // Better heard in the language it arrived in than not heard at all.
            rememberSpokenText(text);
            speechQueue.enqueue({
                id: messageId,
                language: toTtsLanguageTag(state['features/subtitles']._language),
                text
            });
        });
}
