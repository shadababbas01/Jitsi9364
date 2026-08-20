import { DeviceEventEmitter, NativeModules } from 'react-native';
import { AnyAction } from 'redux';

import { IReduxState, IStore } from '../app/types';
import {
    IMelpUtterance,
    MELP_UTTERANCE_READY_EVENT,
    MELP_UTTERANCE_SPEECH_STATE_EVENT,
    getLocalMicRecorderNativeModule
} from '../audio-extraction/functions.native';
import { CONFERENCE_FAILED, CONFERENCE_LEFT, ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { hideSheet, openSheet } from '../base/dialog/actions';
import { SET_AUDIO_MUTED } from '../base/media/actionTypes';
import { MEDIA_TYPE } from '../base/media/constants';
import { PARTICIPANT_LEFT, PARTICIPANT_UPDATED } from '../base/participants/actionTypes';
import { getLocalParticipant, getParticipantDisplayName } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { TRACK_ADDED, TRACK_UPDATED } from '../base/tracks/actionTypes';
import { getTrackByMediaTypeAndParticipant } from '../base/tracks/functions.native';
import { wasRecentlySpoken } from '../caption-tts/spokenText';
import { sendMessage } from '../chat/actions.native';
import transcribeWavFile, { TranscriptionUnreachableError } from '../live-transcribe/native/transcribeWav';
import { hideNotification, showNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE, NOTIFICATION_TYPE } from '../notifications/constants';
import { setToolboxVisible } from '../toolbox/actions.native';
import { setTileView } from '../video-layout/actions.any';

import {
    SET_LIVE_TRANSLATION_ACTIVE,
    SET_LIVE_TRANSLATION_DICTATING,
    SET_LIVE_TRANSLATION_MIC,
    SET_LIVE_TRANSLATION_UNTRANSLATED
} from './actionTypes';
import {
    setLiveTranslationActive,
    setLiveTranslationDictating,
    setLiveTranslationError,
    setLiveTranslationMic,
    setLiveTranslationPending
} from './actions';
import LiveTranslationInviteSheet from './components/native/LiveTranslationInviteSheet';
import {
    LIVE_TRANSLATION_ENDPOINT,
    LIVE_TRANSLATION_INVITE,
    LIVE_TRANSLATION_INVITE_ACCEPTED,
    LIVE_TRANSLATION_INVITE_DECLINED,
    LIVE_TRANSLATION_INVITE_WITHDRAWN,
    LIVE_TRANSLATION_MIC_NONE,
    LIVE_TRANSLATION_MIC_OFF,
    LIVE_TRANSLATION_MIC_ON,
    LIVE_TRANSLATION_MIC_PROPERTY,
    LIVE_TRANSLATION_OVERLAP_UID,
    LIVE_TRANSLATION_SPEAKING_OFF,
    LIVE_TRANSLATION_SPEAKING_ON,
    LIVE_TRANSLATION_SPEAKING_PROPERTY,
    MAX_UTTERANCE_MS,
    REMOTE_AUDIO_DEFAULT_GAIN,
    REMOTE_AUDIO_DUCK_GAIN,
    REMOTE_AUDIO_DUCK_RETRIES_MS,
    REMOTE_AUDIO_MUTED_GAIN,
    SILENCE_MS,
    TRANSCRIBE_TIMEOUT_MS
} from './constants';
import { isParticipantUntranslated, isPlayTranslationOnly } from './functions.any';
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
 * The layout the screen was in when the call was turned on, so closing the call puts it back. Undefined means the
 * layout was being chosen automatically, which is also what it goes back to.
 */
let wasTileViewEnabled: boolean | undefined;

/**
 * Whether the local user is currently being told that somebody is talking over them, so the warning is raised and taken
 * away once rather than on every speech state which arrives while the overlap lasts.
 */
let overlapWarned = false;

/**
 * Who is being answered by the invitation prompt currently on screen, so that the prompt can be taken away again if
 * they change their mind, and so a second invitation does not stack a second prompt on top of the first.
 */
let pendingInviteFrom: string | undefined;

/**
 * The volume of a participant who has only just arrived is set a second and a third time, once their audio is actually
 * playing. These are those pending attempts, held so that leaving the call cancels them.
 */
let duckRetries: Array<ReturnType<typeof setTimeout>> = [];

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
        // Whoever starts a translated call answers the same sheet as whoever is asked to join one: which language
        // everybody is heard in, and whether their own voices are silenced under it, are settled before the call rather
        // than found out during it. A call turned on in answer to an invitation has been through the sheet already.
        if (action.active && action.broadcast !== false && !action.confirmed) {
            _askBeforeStarting(store);

            return;
        }

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
        _syncOverlapWarning(store);

        return result;
    }

    case SET_LIVE_TRANSLATION_DICTATING: {
        const result = next(action);

        _announceSpeaking(store);
        _syncOverlapWarning(store);

        return result;
    }

    // The local user has one microphone, not two: their voice is transmitted to the meeting and dictated for
    // translation at the same time, so muting has to stop both. Mirroring the conference mute here rather than in the
    // button catches every other way of being muted too, a moderator's mute among them.
    case SET_AUDIO_MUTED: {
        const result = next(action);
        const { active, micOn } = store.getState()['features/live-translation'];
        const open = !action.muted;

        if (active && micOn !== open) {
            store.dispatch(setLiveTranslationMic(open));
        }

        return result;
    }

    // Somebody else starting or stopping talking is what turns the overlap warning on and off, and it reaches this
    // device as a presence update rather than as anything audible. Leaving counts as stopping: somebody who hangs up
    // mid-sentence takes their announced speech state with them rather than announcing the end of it.
    case PARTICIPANT_LEFT:
    case PARTICIPANT_UPDATED: {
        const result = next(action);

        if (store.getState()['features/live-translation'].active) {
            _syncOverlapWarning(store);
        }

        return result;
    }

    // Choosing to hear somebody in their own voice gives them their volume back, and choosing the translation again
    // turns them down: the two halves of the choice have to happen together, or a voice is left competing with a
    // translation of itself.
    case SET_LIVE_TRANSLATION_UNTRANSLATED: {
        const result = next(action);
        const state = store.getState();
        const track = getTrackByMediaTypeAndParticipant(
            state['features/base/tracks'], MEDIA_TYPE.AUDIO, action.participantId);

        if (state['features/live-translation'].active && track) {
            _duck(state, track.jitsiTrack, true);
        }

        return result;
    }

    // A participant who joins, or whose track is swapped when the call moves between peer to peer and the bridge, is
    // heard through an audio track this device has not turned down yet, so each one is caught as it appears.
    case TRACK_ADDED: {
        const result = next(action);
        const state = store.getState();

        if (state['features/live-translation'].active && _duck(state, action.track?.jitsiTrack, true)) {
            _duckAgainShortly(store);
        }

        return result;
    }

    // Unmuting can hand the track a new audio sink, which starts at the volume the bridge gave it rather than the one
    // this device asked for.
    case TRACK_UPDATED: {
        const result = next(action);
        const state = store.getState();

        if (state['features/live-translation'].active) {
            _duck(state, action.track?.jitsiTrack, true);
        }

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

    // What the others say is read out translated, and that reading is what the local user is listening for. Their own
    // voices are left as a murmur underneath it so it is still clear who is talking.
    _duckAll(store, true);
    _duckAgainShortly(store);

    // The local voice keeps reaching the others as itself, at full volume, alongside the translation read out on their
    // side: a participant who understands the language spoken should not have to listen to a robot instead. The
    // dictation listens to the same open microphone rather than taking it over, so the one thing that has to be true at
    // the start is that the two agree about whether it is open.
    dispatch(setLiveTranslationMic(!getState()['features/base/media'].audio.muted));

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
 * Ends the call, leaving the conference microphone exactly as the local user has it: the call never took it away, so
 * there is nothing to give back.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _stop(store: IStore) {
    const { dispatch } = store;

    getLocalMicRecorderNativeModule()?.stopUtteranceSession();
    subscriptions.forEach(subscription => subscription.remove());
    subscriptions = [];

    pending = 0;

    // Nothing is being read out any more, so the others are heard in their own voices again.
    _cancelDuckRetries();
    _duckAll(store, false);

    dispatch(setLiveTranslationPending(0));
    dispatch(setLiveTranslationDictating(false));

    // Whoever was talking over whom, it stopped mattering the moment the call did.
    _hideOverlapWarning(store);

    // The audio track speaks for itself again from here on, so the meeting is told to stop reading the announcement.
    _announceMicrophone(store);

    // Whichever layout the local user was watching the meeting in before the call, they go back to.
    dispatch(setTileView(wasTileViewEnabled));
    wasTileViewEnabled = undefined;

    dispatch(setToolboxVisible(true));
}

/**
 * Turns one remote participant's own voice down while the translation panel is up, or back up to the volume the local
 * user has chosen for them once it is gone.
 *
 * Only their untranslated voice is touched: what the panel reads aloud is played by the speech engine, not by this
 * track, so the translation stays at full volume throughout.
 *
 * @param {IReduxState} state - The redux state.
 * @param {Object} jitsiTrack - The track to set the volume of. Anything which is not somebody else's audio is ignored,
 * so callers can pass whatever track an action carried.
 * @param {boolean} ducked - Whether the panel is on screen.
 * @returns {void}
 */
function _duck(state: IReduxState, jitsiTrack: any, ducked: boolean) {
    if (!jitsiTrack || jitsiTrack.isLocal?.() || jitsiTrack.getType?.() !== MEDIA_TYPE.AUDIO) {
        return false;
    }

    const { participantsVolume } = state['features/filmstrip'];
    const participantId = jitsiTrack.getParticipantId?.();
    const chosen = participantsVolume[participantId];

    // Somebody the local user asked to hear in their own voice keeps their volume: nothing is going to be read out over
    // the top of them, so there is nothing to make room for.
    const quiet = ducked && !isParticipantUntranslated(state, participantId);

    // How quiet is the local user's own choice: a murmur under the translation, or nothing at all.
    const quietGain = isPlayTranslationOnly(state) ? REMOTE_AUDIO_MUTED_GAIN : REMOTE_AUDIO_DUCK_GAIN;
    const volume = quiet ? quietGain : chosen ?? REMOTE_AUDIO_DEFAULT_GAIN;
    const track = jitsiTrack.track;

    if (typeof track?._setVolume !== 'function') {
        logger.warn(`No volume to set on the audio of ${participantId}`);

        return false;
    }

    try {
        // The volume of a single remote track, which react-native-webrtc adds to the standard track: there is no audio
        // element on mobile to set a volume on, the way the web version does it.
        track._setVolume(volume);
    } catch (error) {
        logger.warn(`Could not change how loud ${participantId} is heard`, error);

        return false;
    }

    return true;
}

/**
 * Turns every remote participant currently in the meeting down, or back up.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} ducked - Whether the panel is on screen.
 * @returns {void}
 */
function _duckAll({ getState }: IStore, ducked: boolean) {
    const state = getState();
    const done = state['features/base/tracks']
        .filter(track => _duck(state, track.jitsiTrack, ducked)).length;

    logger.info(`${ducked ? 'Turned down' : 'Restored'} the volume of ${done} remote participant(s)`);
}

/**
 * Turns everybody down again in a moment, and once more after that.
 *
 * The volume of a track which has only just been added does not always take: it is set on an audio sink which the
 * engine has not created yet, and is dropped rather than kept for when it has. Asking again once the participant is
 * being heard is what makes it stick.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _duckAgainShortly(store: IStore) {
    _cancelDuckRetries();

    duckRetries = REMOTE_AUDIO_DUCK_RETRIES_MS.map(delay => setTimeout(() => {
        if (store.getState()['features/live-translation'].active) {
            _duckAll(store, true);
        }
    }, delay));
}

/**
 * Drops the pending attempts, so that a call which has ended cannot turn anybody down after the fact.
 *
 * @returns {void}
 */
function _cancelDuckRetries() {
    duckRetries.forEach(retry => clearTimeout(retry));
    duckRetries = [];
}

/**
 * Warns the local user when somebody else is talking at the same time as they are.
 *
 * Only the people talking over each other are told, because they are the only ones who can do anything about it: a
 * listener hearing two translations arrive together does not need a warning, they need the translations. Nothing is
 * suppressed either way - both utterances are transcribed and sent, since each was captured on its own device and
 * neither can contaminate the other. What overlapping speech costs is the listener's attention, and that is what the
 * warning is about.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncOverlapWarning(store: IStore) {
    const state = store.getState();
    const { active, dictating, micOn } = state['features/live-translation'];
    const speakingLocally = active && micOn && dictating;

    // Everybody else's speech state comes out of presence: with the dictation running there is no audio level to read
    // it from, which is why it is announced in the first place.
    const othersSpeaking = speakingLocally && Array.from(state['features/base/participants'].remote.values())
        .some(participant => participant.liveTranslationSpeaking === LIVE_TRANSLATION_SPEAKING_ON);

    if (othersSpeaking === overlapWarned) {
        return;
    }

    overlapWarned = othersSpeaking;

    if (othersSpeaking) {
        store.dispatch(showNotification({
            appearance: NOTIFICATION_TYPE.WARNING,
            titleKey: 'liveTranslation.multipleSpeakers',
            uid: LIVE_TRANSLATION_OVERLAP_UID
        }, NOTIFICATION_TIMEOUT_TYPE.STICKY));
    } else {
        store.dispatch(hideNotification(LIVE_TRANSLATION_OVERLAP_UID));
    }
}

/**
 * Takes the overlap warning away, whether or not it is on screen.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _hideOverlapWarning({ dispatch }: IStore) {
    overlapWarned = false;
    dispatch(hideNotification(LIVE_TRANSLATION_OVERLAP_UID));
}

/**
 * Puts the sheet which settles what a translated call sounds like on screen, and starts the call if it is saved.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _askBeforeStarting(store: IStore) {
    store.dispatch(openSheet(LiveTranslationInviteSheet, {
        onAllow: () => store.dispatch(setLiveTranslationActive(true, true, true)),

        // Nothing to undo: the call was never started, and the sheet writes no settings unless it is saved.
        onDecline: () => {
            // Deliberately empty.
        },
        starting: true
    }));
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

        dispatch(openSheet(LiveTranslationInviteSheet, {
            inviterName: name,
            onAllow: () => {
                pendingInviteFrom = undefined;

                // False, because this call is the answer to an invitation and must not send one of its own back.
                dispatch(setLiveTranslationActive(true, false));
                _send(store, LIVE_TRANSLATION_INVITE_ACCEPTED, from);
            },
            onDecline: () => {
                pendingInviteFrom = undefined;
                _send(store, LIVE_TRANSLATION_INVITE_DECLINED, from);
            }
        }));
        break;
    }

    case LIVE_TRANSLATION_INVITE_WITHDRAWN: {
        // Only a prompt nobody has answered yet is stale. Somebody who already joined stays joined: the inviter
        // leaving the call is not a reason to throw everybody else out of it.
        if (pendingInviteFrom === from) {
            pendingInviteFrom = undefined;
            dispatch(hideSheet());
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
 * Deafens or un-deafens the recorder to match what the local user has their microphone set to.
 *
 * The microphone deliberately stays open while the device is reading a message out loud. Closing it there would be the
 * safer thing to do about echo - what comes out of the loudspeaker can be heard, transcribed and sent back - but it also
 * makes the call half-duplex: whoever wants to answer has to wait for the translation of the previous sentence to
 * finish, and what they say in the meantime is lost rather than queued. A conversation is worth more than the echo is
 * worth avoiding, so the two remaining defences carry it instead: the platform echo canceller on the capture, and the
 * text backstop in caption-tts/spokenText.ts, which drops a transcript repeating what was just spoken.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncMicrophone({ dispatch, getState }: IStore) {
    const recorder = getLocalMicRecorderNativeModule();
    const { active, micOn } = getState()['features/live-translation'];

    if (!recorder?.setUtteranceSessionMuted || !active) {
        return;
    }

    recorder.setUtteranceSessionMuted(!micOn);

    if (!micOn) {
        dispatch(setLiveTranslationDictating(false));
    }
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

        // An outage and a rejected sentence look the same to the person talking unless they are told apart: one is
        // worth waiting out, the other is worth trying again in different words.
        dispatch(setLiveTranslationError(error instanceof TranscriptionUnreachableError
            ? 'liveTranslation.serviceDown'
            : 'liveTranslation.failed'));
    } finally {
        dispatch(setLiveTranslationPending(--pending));
    }
}
