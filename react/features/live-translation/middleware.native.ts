import { DeviceEventEmitter, NativeModules } from 'react-native';
import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import {
    IMelpUtterance,
    MELP_UTTERANCE_READY_EVENT,
    MELP_UTTERANCE_SPEECH_STATE_EVENT,
    getLocalMicRecorderNativeModule
} from '../audio-extraction/functions.native';
import { CONFERENCE_FAILED, CONFERENCE_LEFT, ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { hideDialog, openDialog } from '../base/dialog/actions';
import ConfirmDialog from '../base/dialog/components/native/ConfirmDialog';
import { setAudioMuted } from '../base/media/actions';
import { getLocalParticipant, getParticipantDisplayName } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SET_CAPTION_TTS_SPEAKING, SET_CHAT_TTS_SPEAKER } from '../caption-tts/actionTypes';
import { isReadingAloud } from '../caption-tts/functions.native';
import { wasRecentlySpoken } from '../caption-tts/spokenText';
import { sendMessage } from '../chat/actions.native';
import transcribeWavFile from '../live-transcribe/native/transcribeWav';
import { showNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../notifications/constants';
import { setToolboxVisible } from '../toolbox/actions.native';
import { setTileView } from '../video-layout/actions.any';

import {
    SET_LIVE_TRANSLATION_ACTIVE,
    SET_LIVE_TRANSLATION_DICTATING,
    SET_LIVE_TRANSLATION_MIC
} from './actionTypes';
import {
    setLiveTranslationActive,
    setLiveTranslationDictating,
    setLiveTranslationError,
    setLiveTranslationPending
} from './actions';
import {
    ECHO_TAIL_MS,
    LIVE_TRANSLATION_ENDPOINT,
    LIVE_TRANSLATION_INVITE,
    LIVE_TRANSLATION_INVITE_ACCEPTED,
    LIVE_TRANSLATION_INVITE_DECLINED,
    LIVE_TRANSLATION_INVITE_WITHDRAWN,
    LIVE_TRANSLATION_MIC_NONE,
    LIVE_TRANSLATION_MIC_OFF,
    LIVE_TRANSLATION_MIC_ON,
    LIVE_TRANSLATION_MIC_PROPERTY,
    LIVE_TRANSLATION_SPEAKING_OFF,
    LIVE_TRANSLATION_SPEAKING_ON,
    LIVE_TRANSLATION_SPEAKING_PROPERTY,
    MAX_UTTERANCE_MS,
    SILENCE_MS,
    TRANSCRIBE_TIMEOUT_MS
} from './constants';
import logger from './logger';

const { AudioMode } = NativeModules;

/**
 * The listeners on the recorder, held for as long as the call is running.
 */
let subscriptions: Array<{ remove: () => void; }> = [];

/**
 * Utterances are transcribed one after the other, so what was said first is also sent first.
 */
let chain: Promise<void> = Promise.resolve();

/**
 * How many utterances are on their way to being sent, mirrored into redux for the UI.
 */
let pending = 0;

/**
 * Whether the microphone the conference sends was already muted when the call was turned on. The state it was found in
 * is the state it is put back into.
 */
let wasAudioMuted = false;

/**
 * The layout the screen was in when the call was turned on, so closing the call puts it back. Undefined means the
 * layout was being chosen automatically, which is also what it goes back to.
 */
let wasTileViewEnabled: boolean | undefined;

/**
 * Released once the device has finished speaking, so the microphone is not opened while the room still carries the tail
 * of what was said.
 */
let echoTailTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * Who is being answered by the invitation prompt currently on screen, so that the prompt can be taken away again if
 * they change their mind, and so a second invitation does not stack a second prompt on top of the first.
 */
let pendingInviteFrom: string | undefined;

/**
 * The name the dialog asking to join a translated call is opened under, so that withdrawing an invitation closes that
 * dialog rather than whatever else happens to be on screen.
 */
const INVITE_DIALOG = 'LiveTranslationInvite';

/**
 * The live translation call: the local participant speaks, each utterance is transcribed and sent to the meeting as a
 * chat message, and what other participants send is translated and read out loud by the caption-tts chat middleware.
 *
 * The capture lives here rather than in the panel so there is exactly one of it: the panel over the video and the chat
 * screen are two views of the same call, and two recorders would send everything twice.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    switch (action.type) {
    case SET_LIVE_TRANSLATION_ACTIVE: {
        const result = next(action);

        if (action.active) {
            _start(store);
        } else {
            _stop(store);
        }

        // Turning the call on asks the meeting to join it; turning it off again takes an unanswered invitation back.
        // A call turned on in answer to somebody else's invitation says nothing, or the two would invite each other in
        // circles.
        if (action.broadcast !== false) {
            _send(store, action.active ? LIVE_TRANSLATION_INVITE : LIVE_TRANSLATION_INVITE_WITHDRAWN);
        }

        return result;
    }

    case ENDPOINT_MESSAGE_RECEIVED: {
        const result = next(action);

        _handleEndpointMessage(store, action);

        return result;
    }

    case SET_LIVE_TRANSLATION_MIC: {
        const result = next(action);

        _syncMicrophone(store);
        _announceMicrophone(store);

        // Closing the microphone stops the dictation with it, which the others have to hear about too.
        _announceSpeaking(store);

        return result;
    }

    case SET_LIVE_TRANSLATION_DICTATING: {
        const result = next(action);

        _announceSpeaking(store);

        return result;
    }

    // The device speaking is the one thing which must close the microphone: what comes out of the loudspeaker would
    // otherwise be heard, transcribed, and sent back for the other side to read out in turn. Captions being read aloud
    // count just as much as messages.
    case SET_CAPTION_TTS_SPEAKING:
    case SET_CHAT_TTS_SPEAKER: {
        const result = next(action);

        _syncMicrophone(store);

        return result;
    }

    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT: {
        const result = next(action);

        pendingInviteFrom = undefined;

        if (store.getState()['features/live-translation']?.active) {
            store.dispatch(setLiveTranslationActive(false, false));
        }

        return result;
    }
    }

    return next(action);
});

/**
 * Starts the call: routes the audio to the loudspeaker, mutes the conference microphone and opens the recorder.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _start(store: IStore) {
    const { dispatch, getState } = store;
    const recorder = getLocalMicRecorderNativeModule();

    if (!recorder?.startUtteranceSession) {
        dispatch(setLiveTranslationError('liveTranslation.unavailable'));

        return;
    }

    // Messages are read out loud, so they have to come out of the loudspeaker rather than the earpiece: the phone is
    // not held to the ear during a translated call, it is put down between the people talking.
    try {
        AudioMode?.setAudioDevice?.('SPEAKER');
    } catch (error) {
        logger.warn('Could not route the audio to the loudspeaker', error);
    }

    // The local voice reaches the others as a translated message read out on their side, so letting the conference
    // microphone through as well would say everything twice.
    wasAudioMuted = Boolean(getState()['features/base/media'].audio.muted);
    dispatch(setAudioMuted(true));

    // The panel lives under the tile grid, which is the only layout that gives up the room it needs, so the call opens
    // the screen it is shown on the same way the live captions panel does.
    wasTileViewEnabled = getState()['features/video-layout'].tileViewEnabled;
    dispatch(setTileView(true));

    // The panel needs the bottom of the screen. The toolbar is not gone for good: a tap on the video brings it back.
    dispatch(setToolboxVisible(false));

    subscriptions = [
        DeviceEventEmitter.addListener(MELP_UTTERANCE_READY_EVENT, (utterance: IMelpUtterance) => {
            if (!utterance?.path) {
                return;
            }

            chain = chain
                .then(() => _transcribeAndSend(store, utterance))
                .catch(() => { /* Already reported; the chain must survive it. */ });
        }),
        DeviceEventEmitter.addListener(MELP_UTTERANCE_SPEECH_STATE_EVENT, (event: { speaking?: boolean; }) => {
            dispatch(setLiveTranslationDictating(Boolean(event?.speaking)));
        })
    ];

    _announceMicrophone(store);

    // Nobody is talking yet, and whatever the last call left announced has to be cleared.
    _announceSpeaking(store);

    recorder.startUtteranceSession(SILENCE_MS, MAX_UTTERANCE_MS)
        .catch(error => {
            logger.warn('Could not open the microphone for the live translation call', error);
            dispatch(setLiveTranslationError('liveTranslation.unavailable'));
        });

    _syncMicrophone(store);
}

/**
 * Ends the call and puts the conference microphone back the way it was found.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _stop(store: IStore) {
    const { dispatch, getState } = store;
    const { micOn } = getState()['features/live-translation'];

    getLocalMicRecorderNativeModule()?.stopUtteranceSession();
    subscriptions.forEach(subscription => subscription.remove());
    subscriptions = [];

    if (echoTailTimeout) {
        clearTimeout(echoTailTimeout);
        echoTailTimeout = undefined;
    }

    pending = 0;

    dispatch(setLiveTranslationPending(0));
    dispatch(setLiveTranslationDictating(false));

    // Back to transmitting, unless the local user was muted before the call started or closed the microphone during it:
    // leaving the translated call is not a reason to start broadcasting somebody who had muted themselves.
    if (!wasAudioMuted && micOn) {
        dispatch(setAudioMuted(false, true));
    }

    // The audio track speaks for itself again from here on, so the meeting is told to stop reading the announcement.
    _announceMicrophone(store);

    // Whichever layout the local user was watching the meeting in before the call, they go back to.
    dispatch(setTileView(wasTileViewEnabled));
    wasTileViewEnabled = undefined;

    dispatch(setToolboxVisible(true));
}

/**
 * Says something to the whole meeting on the live translation channel, or to one participant when a particular person
 * is being answered.
 *
 * @param {IStore} store - The redux store.
 * @param {string} what - Which of the things this channel can say.
 * @param {string} to - Who to say it to. Everybody, when left out.
 * @returns {void}
 */
function _send({ getState }: IStore, what: string, to = '') {
    const state = getState();

    try {
        // Over XMPP rather than the bridge channel, which does not exist in a two person call: those run peer to peer,
        // with no videobridge in the middle to carry an endpoint message. The receiving side sees the same
        // ENDPOINT_MESSAGE_RECEIVED either way.
        getCurrentConference(state)?.sendMessage?.({
            name: LIVE_TRANSLATION_ENDPOINT,
            action: what,
            participantId: getLocalParticipant(state)?.id
        }, to, false);
    } catch (error) {
        // An invitation is not worth failing a call over.
        logger.warn(`Could not send "${what}" to the meeting`, error);
    }
}

/**
 * Handles what the other participants say on the live translation channel: an invitation to join a translated call, an
 * invitation taken back, or an answer to one this device sent.
 *
 * @param {IStore} store - The redux store.
 * @param {Object} action - The received endpoint message action.
 * @returns {void}
 */
function _handleEndpointMessage(store: IStore, { data, participant }: AnyAction) {
    if (data?.name !== LIVE_TRANSLATION_ENDPOINT) {
        return;
    }

    const { dispatch, getState } = store;
    const state = getState();
    const from = data.participantId || participant?.getId?.();

    if (!from) {
        return;
    }

    const name = getParticipantDisplayName(state, from);

    switch (data.action) {
    case LIVE_TRANSLATION_INVITE: {
        // Nothing to ask somebody who is already in the call, already being asked, or whose device cannot dictate at
        // all - the last would be an invitation they can only refuse.
        if (state['features/live-translation'].active
                || pendingInviteFrom
                || !getLocalMicRecorderNativeModule()?.startUtteranceSession) {
            return;
        }

        pendingInviteFrom = from;

        dispatch(openDialog(INVITE_DIALOG, ConfirmDialog, {
            confirmLabel: 'liveTranslation.inviteAllow',
            descriptionKey: {
                key: 'liveTranslation.inviteDescription',
                params: { name }
            },
            onCancel: () => {
                pendingInviteFrom = undefined;
                _send(store, LIVE_TRANSLATION_INVITE_DECLINED, from);

                return true;
            },
            onSubmit: () => {
                pendingInviteFrom = undefined;

                // False, because this call is the answer to an invitation and must not send one of its own back.
                dispatch(setLiveTranslationActive(true, false));
                _send(store, LIVE_TRANSLATION_INVITE_ACCEPTED, from);

                return true;
            },
            title: 'liveTranslation.inviteTitle'
        }));
        break;
    }

    case LIVE_TRANSLATION_INVITE_WITHDRAWN: {
        // Only a prompt nobody has answered yet is stale. Somebody who already joined stays joined: the inviter
        // leaving the call is not a reason to throw everybody else out of it.
        if (pendingInviteFrom === from) {
            pendingInviteFrom = undefined;
            dispatch(hideDialog(INVITE_DIALOG, ConfirmDialog));
        }
        break;
    }

    case LIVE_TRANSLATION_INVITE_ACCEPTED:
    case LIVE_TRANSLATION_INVITE_DECLINED: {
        dispatch(showNotification({
            descriptionKey: data.action === LIVE_TRANSLATION_INVITE_ACCEPTED
                ? 'liveTranslation.inviteAccepted'
                : 'liveTranslation.inviteDeclined',
            descriptionArguments: { name },
            titleKey: 'liveTranslation.title'
        }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
        break;
    }
    }
}

/**
 * Tells the rest of the meeting whether the local microphone is open.
 *
 * The conference microphone is muted for the whole of a translated call - what the local user says reaches the others as
 * a message read out on their side, not as their own voice - so the audio track everybody else can see says "muted" no
 * matter what the local user does with their microphone. That is the one thing the others still need to know, if only so
 * they can tell whether they are being listened to, so it is announced in presence instead and their copy of this tile
 * is drawn from that.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _announceMicrophone({ getState }: IStore) {
    const state = getState();
    const { active, micOn } = state['features/live-translation'];
    let value = LIVE_TRANSLATION_MIC_NONE;

    if (active) {
        value = micOn ? LIVE_TRANSLATION_MIC_ON : LIVE_TRANSLATION_MIC_OFF;
    }

    try {
        getCurrentConference(state)?.setLocalParticipantProperty(LIVE_TRANSLATION_MIC_PROPERTY, value);
    } catch (error) {
        logger.warn('Could not tell the meeting about the live translation microphone', error);
    }
}

/**
 * Tells the rest of the meeting whether the recorder is hearing the local participant right now, so their tile can be
 * outlined on everybody else's screen exactly as a speaker's tile is in an ordinary call.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _announceSpeaking({ getState }: IStore) {
    const state = getState();
    const { active, dictating, micOn } = state['features/live-translation'];
    const value = active && micOn && dictating ? LIVE_TRANSLATION_SPEAKING_ON : LIVE_TRANSLATION_SPEAKING_OFF;

    try {
        getCurrentConference(state)?.setLocalParticipantProperty(LIVE_TRANSLATION_SPEAKING_PROPERTY, value);
    } catch (error) {
        logger.warn('Could not tell the meeting about the live translation speech state', error);
    }
}

/**
 * Deafens or un-deafens the recorder to match what the call is doing: it hears nothing while the local user closed the
 * microphone, nor while the device is reading a message out loud.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncMicrophone({ dispatch, getState }: IStore) {
    const recorder = getLocalMicRecorderNativeModule();
    const state = getState();
    const { active, micOn } = state['features/live-translation'];

    if (!recorder?.setUtteranceSessionMuted || !active) {
        return;
    }

    if (echoTailTimeout) {
        clearTimeout(echoTailTimeout);
        echoTailTimeout = undefined;
    }

    if (!micOn || isReadingAloud(state)) {
        recorder.setUtteranceSessionMuted(true);
        dispatch(setLiveTranslationDictating(false));

        return;
    }

    // A room reverberates, so the last syllable out of the loudspeaker is still in the air after the engine reports it
    // done. Opening the microphone straight away would record it.
    echoTailTimeout = setTimeout(() => {
        recorder.setUtteranceSessionMuted(false);
    }, ECHO_TAIL_MS);
}

/**
 * Transcribes an utterance and sends it to the meeting as a chat message.
 *
 * @param {IStore} store - The redux store.
 * @param {IMelpUtterance} utterance - The recorded utterance.
 * @returns {Promise<void>}
 */
async function _transcribeAndSend({ dispatch }: IStore, utterance: IMelpUtterance) {
    const fileName = utterance.path.split('/').pop() || 'utterance.wav';

    dispatch(setLiveTranslationPending(++pending));

    try {
        const transcript = await transcribeWavFile(utterance.path, fileName, TRANSCRIBE_TIMEOUT_MS);

        if (!transcript) {
            return;
        }

        // The backstop to deafening the microphone: what leaked through the gate is the device hearing its own voice,
        // and sending it back would have the other side read it out and echo it to us in turn.
        if (wasRecentlySpoken(transcript)) {
            logger.info('Dropped a transcript which repeats what was just read aloud');

            return;
        }

        dispatch(sendMessage(transcript));
        dispatch(setLiveTranslationError(null));
    } catch (error) {
        logger.warn('Could not turn an utterance into a message', error);
        dispatch(setLiveTranslationError('liveTranslation.failed'));
    } finally {
        dispatch(setLiveTranslationPending(--pending));
    }
}
