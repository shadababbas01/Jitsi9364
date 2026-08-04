import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    ENDPOINT_MESSAGE_RECEIVED
} from '../base/conference/actionTypes';
import { SET_AUDIO_MUTED } from '../base/media/actionTypes';
import { getLocalParticipant, getParticipantDisplayName } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SETTINGS_UPDATED } from '../base/settings/actionTypes';
import { APP_STATE_CHANGED } from '../mobile/background/actionTypes';
import { removeTranscriptMessage, storeSubtitle, updateTranscriptMessage } from '../subtitles/actions.any';

import { setLiveTranscribeError, setLiveTranscribeRunning } from './actions';
import {
    JSON_TYPE_LOCAL_TRANSCRIPTION,
    MAX_REMOTE_TEXT_LENGTH,
    TRANSCRIBED_LANGUAGE_TAG
} from './constants';
import { isLiveTranscribeEnabled, isLiveTranscribeSupported } from './functions.native';
import logger from './logger';
import LocalAudioTap from './native/LocalAudioTap';
import MelpTranscribeClient from './native/MelpTranscribeClient';
import { IUtterance } from './types';

/**
 * How long a caption stays on the stage before it is cleared. Matches what the subtitles feature does with the
 * transcriber's captions, so that captions from both sources behave the same on screen.
 */
const REMOVE_AFTER_MS = 3000;

/**
 * How many caption IDs are remembered in order to ignore a message which arrives twice.
 */
const SEEN_CACHE_LIMIT = 200;

/**
 * The tap reading the local microphone. Created on first use.
 */
let tap: LocalAudioTap | undefined;

/**
 * The connection to the transcription service, owned here and released together with the tap.
 */
let client: MelpTranscribeClient | undefined;

/**
 * Counts the utterances captured in this session, so that each caption gets an ID of its own.
 */
let utteranceCount = 0;

/**
 * Whether the tap is currently meant to be running. Tracked rather than read back off the tap, because starting is
 * asynchronous and the tap is therefore not yet running at the moment it has been asked to.
 */
let desired = false;

/**
 * Whether the application is in the foreground. The microphone is not read in the background: the operating system
 * throttles the work and the local user cannot see the captions being produced anyway.
 */
let foreground = true;

/**
 * The IDs of the captions which have already been displayed, so that a message delivered twice is not shown twice.
 */
const seenMessageIds = new Set<string>();

/**
 * Whether this device can capture the local participant's speech at all. Checked once, since the middleware sees every
 * action.
 */
const supported = isLiveTranscribeSupported();

/**
 * Middleware which transcribes the local participant's own speech into live captions.
 *
 * Every device transcribes its own microphone and publishes the text to the room, rather than one device trying to
 * transcribe the mixed audio of everyone else. That is not just cheaper: the local microphone is the only signal where
 * the speaker is known for certain, so captions come out attributed without anyone having to guess who was talking, and
 * the work spreads across the participants instead of piling onto whoever happens to be listening.
 *
 * The audio itself comes from the WebRTC audio device module rather than from a recorder of our own, and is cut into
 * utterances there; see the native {@code LocalAudioTap} for why.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    if (!supported) {
        return next(action);
    }

    switch (action.type) {
    case ENDPOINT_MESSAGE_RECEIVED:
        _maybeShowRemoteCaption(store, action);
        break;

    case APP_STATE_CHANGED: {
        const result = next(action);

        foreground = action.appState === 'active';
        _sync(store);

        return result;
    }

    case CONFERENCE_JOINED:
    case SET_AUDIO_MUTED:
    case SETTINGS_UPDATED: {
        const result = next(action);

        _sync(store);

        return result;
    }

    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT: {
        const result = next(action);

        _teardown(store);

        return result;
    }
    }

    return next(action);
});

/**
 * Starts or stops reading the microphone so that it matches what the current state calls for.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _sync(store: IStore) {
    const state = store.getState();
    const { conference } = state['features/base/conference'];
    const muted = state['features/base/media'].audio.muted;

    // Muting has to stop the tap rather than merely discard what it produces. The audio device module keeps recording
    // while a track is muted, so a muted participant whose speech was still being transcribed would be publishing
    // captions of a conversation they believe nobody can hear.
    const wanted = Boolean(isLiveTranscribeEnabled(state) && conference && !muted && foreground);

    if (wanted === desired) {
        return;
    }

    desired = wanted;

    if (!wanted) {
        tap?.stop();
        store.dispatch(setLiveTranscribeRunning(false));

        return;
    }

    _getTap(store).start().then(started => {
        // The state can have moved on while the tap was coming up, and the tap stops itself when it has; reporting
        // what it actually did rather than what was asked of it keeps the UI honest.
        store.dispatch(setLiveTranscribeRunning(started));

        if (!started && desired) {
            store.dispatch(setLiveTranscribeError('unavailable'));
        }
    });
}

/**
 * Releases the tap and the connection to the transcription service.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _teardown(store: IStore) {
    tap?.destroy();
    tap = undefined;
    client?.destroy();
    client = undefined;
    desired = false;
    utteranceCount = 0;
    seenMessageIds.clear();
    store.dispatch(setLiveTranscribeRunning(false));
    store.dispatch(setLiveTranscribeError(null));
}

/**
 * Returns the microphone tap, creating it and the connection to the transcription service if necessary.
 *
 * @param {IStore} store - The redux store.
 * @returns {LocalAudioTap}
 */
function _getTap(store: IStore): LocalAudioTap {
    if (!tap) {
        tap = new LocalAudioTap(event => {
            const utterance: IUtterance = {
                data: event.data,
                durationMs: event.durationMs,
                id: _nextUtteranceId(store),
                sampleRate: event.sampleRate
            };

            // Printed alongside the text below so that the capture order and the printed order can be compared: the
            // service serves overlapping requests out of a shared pool, so they do not otherwise come back in the
            // order they were spoken.
            logger.info(`[speech] captured #${utteranceCount} (${utterance.durationMs}ms)`);

            _getClient(store).enqueue(utterance);
        });
    }

    return tap;
}

/**
 * Returns the connection to the transcription service, creating it if necessary.
 *
 * @param {IStore} store - The redux store.
 * @returns {MelpTranscribeClient}
 */
function _getClient(store: IStore): MelpTranscribeClient {
    const { dispatch, getState } = store;

    if (!client) {
        client = new MelpTranscribeClient(
            // The token is read per request rather than captured, because the host application sets it and can refresh
            // it in the middle of a conference.
            () => getState()['features/base/jwt'].jwt,
            {
                onFailingChange: error => dispatch(setLiveTranscribeError(error ? error.message : null)),
                onText: (utterance, text) => _publish(store, utterance.id, text)
            });
    }

    return client;
}

/**
 * Returns an ID for the next utterance, unique across the room.
 *
 * The local participant's ID is part of it because captions from every participant end up in one history, and a counter
 * alone would collide the moment two people spoke.
 *
 * @param {IStore} store - The redux store.
 * @returns {string}
 */
function _nextUtteranceId(store: IStore): string {
    const localId = getLocalParticipant(store.getState())?.id ?? 'local';

    return `lt-${localId}-${++utteranceCount}`;
}

/**
 * Shows a caption of the local participant's own speech and publishes it to everyone else in the room.
 *
 * @param {IStore} store - The redux store.
 * @param {string} id - The caption ID.
 * @param {string} text - What was said.
 * @returns {void}
 */
function _publish(store: IStore, id: string, text: string) {
    const state = store.getState();
    const local = getLocalParticipant(state);

    // Reported by the client in the order the utterances were captured, not in the order the service answered, so this
    // reads back as the local participant actually spoke it.
    logger.info(`[speech] ${id}: ${text}`);

    if (!local) {
        return;
    }

    const timestamp = Date.now();

    _display(store, {
        avatarUrl: local.avatarURL,
        id,
        name: local.name,
        participantId: local.id,
        text,
        timestamp
    });

    const { conference } = state['features/base/conference'];

    if (!conference) {
        return;
    }

    try {
        // Sent to everyone, and deliberately not under the transcriber's own message type: that one is only accepted
        // from hidden participants, and reusing it would mean loosening a check which keeps an ordinary participant
        // from publishing captions in the transcriber's name.
        conference.sendEndpointMessage('', {
            language: TRANSCRIBED_LANGUAGE_TAG,
            message_id: id,
            text,
            timestamp,
            type: JSON_TYPE_LOCAL_TRANSCRIPTION
        });
    } catch (error) {
        logger.warn('Failed to publish a caption to the room', error);
    }
}

/**
 * Shows a caption another participant's device produced from their own microphone.
 *
 * @param {IStore} store - The redux store.
 * @param {AnyAction} action - The {@code ENDPOINT_MESSAGE_RECEIVED} action.
 * @returns {void}
 */
function _maybeShowRemoteCaption(store: IStore, action: AnyAction) {
    const json = action.data;

    if (json?.type !== JSON_TYPE_LOCAL_TRANSCRIPTION) {
        return;
    }

    const text = typeof json.text === 'string' ? json.text.trim() : '';
    const messageId = typeof json.message_id === 'string' ? json.message_id : '';

    if (!text || !messageId || text.length > MAX_REMOTE_TEXT_LENGTH) {
        return;
    }

    // The sender is taken from the connection the message arrived on rather than from the message, so that a
    // participant cannot publish captions in somebody else's name.
    const participantId = action.participant?.getId?.();

    if (!participantId) {
        return;
    }

    const state = store.getState();

    _display(store, {
        id: messageId,
        name: getParticipantDisplayName(state, participantId),
        participantId,
        text,
        timestamp: typeof json.timestamp === 'number' ? json.timestamp : Date.now()
    });
}

/**
 * Puts a caption on the stage and into the captions history.
 *
 * Both are needed: the stage caption is what is rendered over the video and clears itself after a few seconds, while
 * the history is what the captions panel and the closed captions tab scroll through.
 *
 * @param {IStore} store - The redux store.
 * @param {Object} caption - Who said what, when.
 * @returns {void}
 */
function _display(store: IStore, caption: {
    avatarUrl?: string;
    id: string;
    name?: string;
    participantId: string;
    text: string;
    timestamp: number;
}) {
    const { dispatch } = store;

    if (seenMessageIds.has(caption.id)) {
        return;
    }

    seenMessageIds.add(caption.id);

    if (seenMessageIds.size > SEEN_CACHE_LIMIT) {
        // Insertion ordered, so this drops the oldest. The IDs only guard against a message arriving twice in quick
        // succession, so forgetting the old ones costs nothing.
        seenMessageIds.delete(seenMessageIds.values().next().value as string);
    }

    dispatch(storeSubtitle({
        id: caption.id,
        interim: false,
        isTranscription: true,
        language: TRANSCRIBED_LANGUAGE_TAG,
        participantAvatarUrl: caption.avatarUrl,
        participantId: caption.participantId,
        participantName: caption.name,
        text: caption.text,
        timestamp: caption.timestamp
    }));

    dispatch(updateTranscriptMessage(caption.id, {
        final: caption.text,
        participant: {
            avatarUrl: caption.avatarUrl,
            id: caption.participantId,
            name: caption.name
        }
    }));

    // The subtitles middleware clears the transcriber's stage captions itself, but only the ones it created, so this
    // caption has to clear its own or it would stay on the video for the rest of the call.
    setTimeout(() => dispatch(removeTranscriptMessage(caption.id)), REMOVE_AFTER_MS);
}
