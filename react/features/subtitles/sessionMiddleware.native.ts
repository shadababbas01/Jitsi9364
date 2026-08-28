import { AnyAction } from 'redux';

import { IReduxState, IStore } from '../app/types';
import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    ENDPOINT_MESSAGE_RECEIVED
} from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { SET_AUDIO_MUTED } from '../base/media/actionTypes';
import { PARTICIPANT_JOINED, PARTICIPANT_LEFT } from '../base/participants/actionTypes';
import {
    getLocalParticipant,
    getParticipantDisplayName,
    isLocalParticipantModerator
} from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { TRACK_ADDED, TRACK_REMOVED, TRACK_UPDATED } from '../base/tracks/actionTypes';
import { setTranscriptionStartedByCurrentUser, showTranscriptionConsent } from '../chat/actions.any';
import { STT_LOG_TAG } from '../live-transcribe/constants';
import { closeTranscriptionConnection, openTranscriptionConnection } from '../live-transcribe/native/transcribeWav';
import { hideNotification, showNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE, NOTIFICATION_TYPE } from '../notifications/constants';
import { setS2SV2PanelVisible } from '../s2s-v2/actions';
import { isS2SV2Active } from '../s2s-v2/functions';

import {
    SET_REQUESTING_SUBTITLES,
    SET_SUBTITLES_PANEL_OPEN,
    TOGGLE_REQUESTING_SUBTITLES
} from './actionTypes';
import {
    removeTranscriptMessage,
    setCaptionsStartedBy,
    setRequestingSubtitles,
    setSubtitlesPanelOpen,
    storeSubtitle,
    updateTranscriptMessage
} from './actions.any';
import {
    CAPTIONS_LATE_JOINER_DELAYS_MS,
    CAPTIONS_LISTENER_RESEND_DELAYS_MS,
    CAPTIONS_MIC_ERROR_UID,
    CAPTIONS_REMOVE_AFTER_MS,
    CAPTIONS_SEND_RETRY_DELAY_MS,
    CAPTIONS_STATE_REQUEST_DELAYS_MS,
    CAPTIONS_STT_LANGUAGE,
    CAPTIONS_TRANSCRIBE_ERROR_UID
} from './constants';
import { getCaptionsStartedBy, isLiveTranscriptionActive } from './functions.any';
import { normalizeSubtitlesLanguage } from './languages';
import logger from './logger';
import LiveCaptionsCapture from './native/LiveCaptionsCapture';
import {
    ICaptionsControl,
    ICaptionsStateAck,
    ICaptionsStateRequest,
    IListenerState,
    ITranscriptMessage,
    LISTENER_SUBSCRIBE,
    ProcessedTranscripts,
    buildCaptionsControl,
    buildCaptionsStateAck,
    buildCaptionsStateRequest,
    buildListenerState,
    buildNoiseSuppression,
    buildTranscript,
    createTranscriptIdFactory,
    generateCaptionsSessionId,
    isCaptionsControl,
    isCaptionsStateAck,
    isCaptionsStateRequest,
    isListenerState,
    isNoiseSuppression,
    isTranscript
} from './sessionProtocol';

/**
 * The timers still to fire, held so that leaving the conference can drop them.
 *
 * A device which left a meeting must not go on announcing that meeting's caption state into the next one.
 */
let pendingTimers: Array<ReturnType<typeof setTimeout>> = [];

/**
 * Whether the transcription socket is open because captions are running.
 *
 * Tracked rather than inferred, because the socket is shared with the translated session feature: closing one this
 * feature never opened would cost whichever of them is using it the sentence it has in flight.
 */
let connectionOpen = false;

/**
 * Who in the room is listening to the transcript feed.
 *
 * The microphone is opened because somebody is listening, not because captions are nominally on: a room where
 * everybody has turned captions off has nothing to transcribe, and every device recording itself for nobody is the
 * expensive way to produce nothing.
 *
 * Holds authenticated sender IDs only. The identity in the payload is never trusted for this, or one participant could
 * subscribe on another's behalf and hold the room's microphones open.
 */
const listeners = new Set<string>();

/**
 * The transcripts which have already been shown, so that one redelivered is not shown twice.
 */
const processed = new ProcessedTranscripts();

/**
 * Names one outgoing utterance after another.
 */
const nextTranscriptId = createTranscriptIdFactory();

/**
 * How this device's captions identify themselves on the wire.
 *
 * Made once per conference. Receivers in this flow treat it as opaque and only check that it is there; it travels
 * because the contract asks for it and because a service which does key off it needs no protocol change later.
 */
let sessionId = generateCaptionsSessionId();

/**
 * Whether this device has told the room it is listening, so that the same state is not announced twice.
 */
let subscribed = false;

/**
 * Whether the caption flow is the reason microphone noise suppression is on, so that turning captions off releases
 * only an effect this feature actually claimed.
 */
let noiseSuppressionClaimed = false;

/**
 * Whether the local user has already been told that something could not be transcribed.
 */
let transcribeFailureReported = false;

/**
 * Listens to the microphone and turns what it hears into English text.
 */
let capture: LiveCaptionsCapture | undefined;

/**
 * Remembers a timer so that it can be dropped if the conference ends first, and forgets it once it has run.
 *
 * @param {Function} run - What to do.
 * @param {number} delay - When.
 * @returns {void}
 */
function _later(run: () => void, delay: number) {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        pendingTimers = pendingTimers.filter(pending => pending !== timer);
        run();
    }, delay);

    pendingTimers.push(timer);
}

/**
 * Says something on the conference channel.
 *
 * Never throws. The data channel to a given participant is frequently not open yet, which is a timing condition rather
 * than a fault, and the local state which the message describes has already been changed. Both roads are used, because
 * the contract asks for both, and if neither is open the whole thing is tried once more shortly.
 *
 * @param {IReduxState} state - The redux state.
 * @param {Object} payload - What to say.
 * @param {string} target - Who to say it to. Everybody, when left out.
 * @param {boolean} retry - Whether to try again shortly if neither road is open. False on the retry itself, so that a
 * meeting which cannot be reached at all is attempted twice rather than forever.
 * @returns {void}
 */
function _send(state: IReduxState, payload: object, target = '', retry = true) {
    const conference = getCurrentConference(state);

    if (!conference) {
        return;
    }

    let sent = false;

    // The bridge channel first, which is what a web client on the other end uses.
    try {
        conference.sendEndpointMessage?.(target, payload);
        sent = true;
    } catch (error) {
        // Two ordinary situations produce this rather than any fault: a two person call runs peer to peer with no
        // videobridge in the middle to carry an endpoint message at all, and a call which has one has not necessarily
        // opened it yet at the moment somebody joins - which is exactly when a running session has to be announced.
        logger.debug('No bridge channel; going over XMPP instead');
    }

    try {
        // The same message by the other road. The receiving side cannot tell the difference: a JSON message over XMPP
        // arrives as the same ENDPOINT_MESSAGE_RECEIVED carrying the same payload and the same sender. Copied because
        // the library stamps its own marker into whatever object it is handed.
        conference.sendMessage?.({ ...payload }, target, false);
        sent = true;
    } catch (error) {
        logger.debug('Could not send over XMPP either');
    }

    if (!sent && retry) {
        _later(() => _send(state, payload, target, false), CAPTIONS_SEND_RETRY_DELAY_MS);
    }
}

/**
 * Opens or closes the connection which turns recorded utterances into text.
 *
 * Opened when somebody starts listening rather than by the first thing anybody says, so that the socket is already
 * there when a one second pause hands the first utterance over: the alternative is paying for a handshake in the
 * middle of the first sentence of the meeting.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} wanted - Whether anything is going to be transcribed.
 * @returns {void}
 */
function _syncConnection(store: IStore, wanted: boolean) {
    if (wanted === connectionOpen) {
        return;
    }

    connectionOpen = wanted;

    if (!wanted) {
        // Only when this feature was the one holding it open. The socket is shared with the translated session
        // feature, and closing one mid-utterance would cost it the sentence in flight.
        if (isS2SV2Active(store.getState())) {
            logger.info(`${STT_LOG_TAG} captions are off, but a translated session still needs the connection`);

            return;
        }

        logger.info(`${STT_LOG_TAG} nobody is listening; closing the transcription connection`);
        closeTranscriptionConnection();

        return;
    }

    logger.info(`${STT_LOG_TAG} somebody is listening; opening the transcription connection`);
    openTranscriptionConnection({
        jwt: store.getState()['features/base/jwt'].jwt,
        language: CAPTIONS_STT_LANGUAGE
    });
}

/**
 * Claims or releases the microphone effect the captions own.
 *
 * There is no noise suppression effect on this platform: the one the application ships is an AudioWorklet, which is
 * web only, and the native recorder exposes no equivalent. So this keeps the ownership bookkeeping honest - which is
 * what stops a release taking away an effect this feature never claimed - while the announcement on the wire lets
 * clients which do have an effect act on it. The local apply is the one seam a native implementation would fill in.
 *
 * @param {boolean} enabled - Whether the effect is wanted.
 * @returns {void}
 */
function _syncNoiseSuppression(enabled: boolean) {
    if (enabled === noiseSuppressionClaimed) {
        return;
    }

    noiseSuppressionClaimed = enabled;
    logger.info(`Live captions ${enabled ? 'claimed' : 'released'} microphone noise suppression`);
}

/**
 * Applies a microphone effect state somebody else announced.
 *
 * Released only if the captions were the ones holding it, so that a client turning its own effect off cannot take away
 * one this device claimed for a session which is still running.
 *
 * @param {boolean} enabled - Whether the effect is wanted.
 * @returns {void}
 */
function _onNoiseSuppression(enabled: boolean) {
    if (!enabled && !noiseSuppressionClaimed) {
        return;
    }

    _syncNoiseSuppression(enabled);
}

/**
 * Tells the room whether this device wants the transcript feed.
 *
 * Said three times over a few seconds rather than once, because the channel has no acknowledgement and is frequently
 * not open at the moment it is wanted. Each attempt re-reads the state, so one which has since been reversed says
 * nothing.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} subscribe - Whether this device is listening.
 * @returns {void}
 */
function _announceListening({ getState }: IStore, subscribe: boolean) {
    if (subscribe === subscribed) {
        return;
    }

    subscribed = subscribe;

    CAPTIONS_LISTENER_RESEND_DELAYS_MS.forEach(delay => _later(() => {
        const state = getState();
        const localId = getLocalParticipant(state)?.id;

        if (!localId || subscribed !== subscribe) {
            return;
        }

        _send(state, buildListenerState(subscribe, localId));
    }, delay));
}

/**
 * Records that somebody is, or is no longer, listening, and brings the microphone up or down to match.
 *
 * @param {IStore} store - The redux store.
 * @param {string} participantId - Who.
 * @param {boolean} listening - Whether they want the feed.
 * @returns {void}
 */
function _setListener(store: IStore, participantId: string, listening: boolean) {
    const had = listeners.size > 0;

    if (listening) {
        listeners.add(participantId);
    } else {
        listeners.delete(participantId);
    }

    const has = listeners.size > 0;

    if (had !== has) {
        logger.info(`Live captions ${has ? 'have' : 'no longer have'} listeners (${listeners.size})`);
        _syncCapture(store);
    }
}

/**
 * Returns the microphone capture, making it on first use.
 *
 * @param {IStore} store - The redux store.
 * @returns {LiveCaptionsCapture}
 */
function _getCapture(store: IStore): LiveCaptionsCapture {
    if (capture) {
        return capture;
    }

    capture = new LiveCaptionsCapture(store, {

        // A participant who cannot be captured can still read the room's captions, so this reports the problem and
        // leaves the session running rather than taking it away from them.
        onMicUnavailable: () => store.dispatch(showNotification({
            appearance: NOTIFICATION_TYPE.WARNING,
            descriptionKey: 'liveTranscribe.serviceUnavailable',
            titleKey: 'liveCaptionsPanel.liveSpeechTranslation',
            uid: CAPTIONS_MIC_ERROR_UID
        }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM)),

        // Once, not once per sentence. A service having a bad minute would otherwise bury the meeting in
        // notifications about it.
        onTranscribeFailed: () => {
            if (transcribeFailureReported) {
                return;
            }

            transcribeFailureReported = true;
            store.dispatch(showNotification({
                appearance: NOTIFICATION_TYPE.WARNING,
                descriptionKey: 'liveTranscribe.serviceUnavailable',
                titleKey: 'liveCaptionsPanel.liveSpeechTranslation',
                uid: CAPTIONS_TRANSCRIBE_ERROR_UID
            }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
        },

        onTranscript: (text: string) => _publishTranscript(store, text)
    });

    return capture;
}

/**
 * Starts or stops the microphone to match whether anything would be done with what it hears.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _syncCapture(store: IStore) {
    const wanted = isLiveTranscriptionActive(store.getState()) && listeners.size > 0;

    _syncConnection(store, wanted);

    if (!wanted) {
        capture?.stop();

        return;
    }

    // Every device in the session records its own microphone. That is what makes captions attributed without anybody
    // having to guess who was talking, and what spreads the work across the room instead of piling it onto one device
    // trying to make sense of everybody's audio mixed together.
    _getCapture(store).sync();
}

/**
 * Puts one caption on the stage and into the transcript.
 *
 * Both are needed: the stage caption is what is drawn over the video and clears itself after a few seconds, while the
 * transcript is what the panel scrolls through.
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
    const { dispatch, getState } = store;

    // Settled once, here, rather than read again every time the panel draws. A reader who changes language half way
    // through a meeting is saying what they want to read from now on, not asking for the conversation so far to be
    // rewritten underneath them.
    const readLanguage = normalizeSubtitlesLanguage(getState()['features/subtitles']._language)
        || CAPTIONS_STT_LANGUAGE;

    dispatch(storeSubtitle({
        id: caption.id,
        interim: false,
        isTranscription: true,

        // The language the transcript arrives in, not the one it is read in. Which language a reader sees is settled
        // on their own device, per line, as the panel draws it.
        language: CAPTIONS_STT_LANGUAGE,
        participantAvatarUrl: caption.avatarUrl,
        participantId: caption.participantId,
        participantName: caption.name,
        readLanguage,
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

    // The stage caption has to clear itself, or it stays over the video for the rest of the call.
    _later(() => dispatch(removeTranscriptMessage(caption.id)), CAPTIONS_REMOVE_AFTER_MS);
}

/**
 * Sends one finished utterance to the room, and shows it here at the same moment.
 *
 * Shown locally without waiting, because a broadcast does not come back to whoever sent it and nothing else is going
 * to put this on the speaker's own screen.
 *
 * @param {IStore} store - The redux store.
 * @param {string} text - The English transcript of what was said.
 * @returns {void}
 */
function _publishTranscript(store: IStore, text: string) {
    const state = store.getState();
    const local = getLocalParticipant(state);
    const originalText = (text ?? '').trim();

    if (!local?.id || !originalText) {
        return;
    }

    const messageId = nextTranscriptId();
    const timestamp = Date.now();

    processed.add(messageId);

    _display(store, {
        avatarUrl: local.avatarURL,
        id: messageId,
        name: local.name,
        participantId: local.id,
        text: originalText,
        timestamp
    });

    _send(state, buildTranscript({
        avatarUrl: local.avatarURL,
        messageId,
        originalText,
        sessionId,
        speakerId: local.id,
        speakerName: local.name,
        timestamp
    }));
}

/**
 * Shows one transcript somebody else published.
 *
 * @param {IStore} store - The redux store.
 * @param {ITranscriptMessage} message - What arrived.
 * @param {string} from - The authenticated sender.
 * @returns {void}
 */
function _onTranscript(store: IStore, message: ITranscriptMessage, from?: string) {
    // The sender is taken from the connection the message arrived on rather than from the message, so that a
    // participant cannot publish a transcript in somebody else's name.
    const speakerId = from || message.speakerId;

    if (!speakerId) {
        return;
    }

    const state = store.getState();

    // Their own utterance, come back to them. A broadcast does not return to its sender over the bridge channel, but
    // the same message sent to the room over XMPP does, and without this the device which spoke would show every
    // utterance of its own twice.
    if (speakerId === getLocalParticipant(state)?.id) {
        return;
    }

    if (!isLiveTranscriptionActive(state)) {
        return;
    }

    // Checked and remembered in one step: a check followed by a separate insert leaves a window in which the same
    // transcript is admitted twice.
    if (!processed.add(message.messageId)) {
        return;
    }

    _display(store, {
        avatarUrl: message.participant?.avatar_url,
        id: message.messageId,
        name: message.participant?.name || getParticipantDisplayName(state, speakerId),
        participantId: speakerId,
        text: message.originalText.trim(),
        timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now()
    });
}

/**
 * Tells the meeting that captions have been turned on or off here.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} enabled - Whether they are on.
 * @param {string} startedBy - Who turned them on.
 * @returns {void}
 */
function _broadcast({ getState }: IStore, enabled: boolean, startedBy?: string) {
    const state = getState();

    _send(state, buildCaptionsControl(enabled, startedBy));
    _send(state, buildNoiseSuppression(enabled));

    // The compatibility signal, for transcription UI which predates the control message above and watches a conference
    // command instead. Sent on a different mechanism entirely - a command is presence, not an endpoint message - so it
    // survives the bridge channel not being open, which is the case the control message needs its retries for.
    try {
        getCurrentConference(state)?.sendCommand?.('transcription-active', { value: String(enabled) });
    } catch (error) {
        logger.debug('Could not send the transcription-active command', error);
    }
}

/**
 * Asks the room whether captions are already running.
 *
 * Asked three times over five seconds rather than once. The bridge channel is frequently not open at the moment a
 * device joins, which is precisely the moment this needs asking, and there is no acknowledgement to say it arrived.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _askRoom(store: IStore) {
    CAPTIONS_STATE_REQUEST_DELAYS_MS.forEach(delay => _later(() => {
        const state = store.getState();
        const localId = getLocalParticipant(state)?.id;

        // Somebody has already told us, or we turned them on ourselves in the meantime.
        if (!localId || isLiveTranscriptionActive(state) || !getCurrentConference(state)) {
            return;
        }

        _send(state, buildCaptionsStateRequest(localId));
    }, delay));
}

/**
 * Tells somebody who has only just arrived that captions are already running.
 *
 * Belt and braces alongside their own question: a moderator pushes the state at them as well, because either message
 * arriving is enough and the two are lost in different conditions.
 *
 * @param {IStore} store - The redux store.
 * @param {string} participantId - Who has arrived.
 * @returns {void}
 */
function _announceTo({ getState }: IStore, participantId: string) {
    CAPTIONS_LATE_JOINER_DELAYS_MS.forEach(delay => _later(() => {
        const state = getState();

        if (!isLiveTranscriptionActive(state) || !isLocalParticipantModerator(state)) {
            return;
        }

        _send(
            state,
            buildCaptionsControl(true, getCaptionsStartedBy(state) ?? getLocalParticipant(state)?.id),
            participantId);
    }, delay));
}

/**
 * Applies a caption state somebody else announced.
 *
 * Dispatched with {@code fromRemoteSync}, which is what stops this device re-broadcasting what it has just been told
 * and looping the room.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} enabled - Whether captions are on.
 * @param {string} startedBy - Who turned them on.
 * @returns {void}
 */
function _applyRemote(store: IStore, enabled: boolean, startedBy?: string) {
    const { dispatch, getState } = store;

    if (isLiveTranscriptionActive(getState()) === enabled) {
        return;
    }

    logger.info(`Live captions turned ${enabled ? 'on' : 'off'} by ${startedBy || 'another participant'}`);

    // The language is left exactly as it is. Which language a reader sees is their own choice and is not part of what
    // the room agreed; passing null here would silently reset it on everybody each time somebody toggled.
    dispatch(setRequestingSubtitles(
        enabled,
        false,
        getState()['features/subtitles']._language,
        false,
        {
            fromRemoteSync: true,
            startedBy
        }));
}

/**
 * Asks the local user for consent the first time somebody else turns captions on.
 *
 * Not asked of whoever started them: they know, having just done it. The reliable flag for that is
 * {@code transcriptionStartedByCurrentUser}, and deliberately not {@code transcriptionStarterId}, which is only ever
 * populated on the receiving end of the explicit broadcast and is empty on the initiator's own store. Testing the
 * latter would ask the starter to consent to their own action.
 *
 * @param {IStore} store - The redux store.
 * @param {string} startedBy - Who turned them on.
 * @returns {void}
 */
function _maybeAskConsent(store: IStore, startedBy?: string) {
    const { dispatch, getState } = store;
    const state = getState();
    const { consentDismissedForSession, showTranscriptionConsent: showing, transcriptionStartedByCurrentUser }
        = state['features/chat'];

    if (transcriptionStartedByCurrentUser || consentDismissedForSession || showing) {
        return;
    }

    dispatch(showTranscriptionConsent(
        startedBy ? getParticipantDisplayName(state, startedBy) : '',
        startedBy));
}

/**
 * Returns whether an action is asking for captions to be turned on, as opposed to off.
 *
 * The two ways of asking differ: one carries the state it wants, the other flips whatever is there.
 *
 * @param {IStore} store - The redux store.
 * @param {AnyAction} action - The action about to go through.
 * @returns {boolean}
 */
function _wantsEnable({ getState }: IStore, action: AnyAction): boolean {
    return action.type === TOGGLE_REQUESTING_SUBTITLES
        ? !getState()['features/subtitles']._requestingSubtitles
        : Boolean(action.enabled);
}

/**
 * Brings the session up or down on this device to match whether captions are running.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} wasActive - Whether they were running before the action which just went through.
 * @param {string} startedBy - Who turned them on, when they have just been turned on.
 * @returns {void}
 */
function _settle(store: IStore, wasActive: boolean, startedBy?: string) {
    const { dispatch, getState } = store;
    const isActive = isLiveTranscriptionActive(getState());

    if (isActive === wasActive) {
        return;
    }

    if (!isActive) {
        _announceListening(store, false);
        listeners.clear();
        _syncCapture(store);
        _syncNoiseSuppression(false);
        transcribeFailureReported = false;
        dispatch(hideNotification(CAPTIONS_MIC_ERROR_UID));
        dispatch(hideNotification(CAPTIONS_TRANSCRIBE_ERROR_UID));
        dispatch(setSubtitlesPanelOpen(false));

        return;
    }

    _syncNoiseSuppression(true);

    // This device is a listener as soon as captions are on here, and says so. Its own subscription is recorded
    // directly rather than waited for: a broadcast does not come back to whoever sent it, so nothing else would.
    const localId = getLocalParticipant(getState())?.id;

    if (localId) {
        _setListener(store, localId, true);
    }

    _announceListening(store, true);
    _syncCapture(store);

    // The panel follows the session on rather than being opened from each of the places which can start one - the
    // local user reaching for the control, a control message from somebody else, a late-joiner acknowledgement - so
    // that none of them can be the one which forgets.
    dispatch(setSubtitlesPanelOpen(true));
    _maybeAskConsent(store, startedBy);
}

/**
 * Clears everything a session leaves behind on this device, for when the conference ends.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _teardown(store: IStore) {
    pendingTimers.forEach(timer => clearTimeout(timer));
    pendingTimers = [];

    capture?.stop();
    listeners.clear();
    processed.clear();
    subscribed = false;
    transcribeFailureReported = false;
    sessionId = generateCaptionsSessionId();

    _syncConnection(store, false);
    _syncNoiseSuppression(false);
    store.dispatch(setSubtitlesPanelOpen(false));
}

/**
 * Live Speech Translation: who has it on, who is listening, and what everybody said.
 *
 * Four things keep "are captions on" the same answer everywhere, because any one of them can be the one that is lost:
 *
 * 1. Every local transition is broadcast, and every receiver applies it. Loop-guarded by {@code fromRemoteSync}.
 * 2. A device which has just joined asks the room, three times over five seconds.
 * 3. A moderator pushes the state at each new arrival, three times over five seconds.
 * 4. Every device independently watches for whoever started captions leaving, and turns them off by itself.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    switch (action.type) {
    case CONFERENCE_JOINED: {
        const result = next(action);

        sessionId = generateCaptionsSessionId();
        _askRoom(store);

        return result;
    }

    // Both of the ways captions are turned on and off locally come through here. What the room is told is decided
    // after the fact from whether the answer actually changed, rather than from the action, so that a dispatch which
    // changes nothing says nothing.
    case SET_REQUESTING_SUBTITLES:
    case TOGGLE_REQUESTING_SUBTITLES: {
        const wasActive = isLiveTranscriptionActive(store.getState());

        // Only a moderator starts a session for the room, and hiding the control from everybody else is a courtesy
        // rather than the rule: the check is here as well, because a control which is merely hidden is not a control
        // which cannot be reached. Swallowed rather than reversed - the action never touches the reducer, so there is
        // no moment where this device believes captions are on and the room disagrees.
        //
        // Only starting is refused. Turning them off has to stay open to any device, because that is exactly what
        // every client does by itself when whoever started the session leaves it.
        if (!action.fromRemoteSync
                && _wantsEnable(store, action)
                && !isLocalParticipantModerator(store.getState())) {
            logger.warn('Refused to start live captions: the local participant is not a moderator');

            return;
        }

        const result = next(action);
        const state = store.getState();
        const isActive = isLiveTranscriptionActive(state);
        const localId = getLocalParticipant(state)?.id;

        if (isActive !== wasActive) {
            if (!action.fromRemoteSync && localId) {
                // Recorded before it is announced. This is the only device which knows for certain that it was the one
                // that started them, and the only device the answer does not reach in a message.
                if (isActive && !getCaptionsStartedBy(state)) {
                    store.dispatch(setCaptionsStartedBy(localId));
                }

                // A receiver never re-broadcasts what it has just been told. Without this the room loops: A tells B, B
                // tells A and C, C tells A and B, and so on for as long as the meeting lasts.
                _broadcast(store, isActive, getCaptionsStartedBy(store.getState()) ?? localId);
            }

            // Whoever reached for the control locally is the one person who should never be asked to consent to it.
            if (isActive && !action.fromRemoteSync) {
                store.dispatch(setTranscriptionStartedByCurrentUser(true));
            }
        }

        _settle(store, wasActive, action.startedBy ?? (action.fromRemoteSync ? undefined : localId));

        return result;
    }

    // One microphone, not two: the local voice reaches the meeting and is transcribed off the same track, so muting
    // has to stop both. Watching the conference mute rather than a button catches every other way of being muted as
    // well, a moderator muting the room among them.
    case SET_AUDIO_MUTED:
    case TRACK_ADDED:
    case TRACK_UPDATED:
    case TRACK_REMOVED: {
        const result = next(action);

        if (isLiveTranscriptionActive(store.getState())) {
            _syncCapture(store);
        }

        return result;
    }

    // The two panels are mutually exclusive: both are drawn in the room the tile grid gives up, and opening one over
    // the other would leave the meeting with two half-screen panels and no video.
    case SET_SUBTITLES_PANEL_OPEN: {
        const result = next(action);

        if (action.open && isS2SV2Active(store.getState())) {
            store.dispatch(setS2SV2PanelVisible(false));
        }

        return result;
    }

    case ENDPOINT_MESSAGE_RECEIVED: {
        const result = next(action);
        const { data, participant } = action;
        const from = participant?.getId?.();

        if (isCaptionsControl(data)) {
            const control = data as ICaptionsControl;

            _applyRemote(store, control.enabled, control.startedBy || from);
        } else if (isCaptionsStateRequest(data)) {
            const state = store.getState();
            const requester = (data as ICaptionsStateRequest).requesterId || from;

            // Answered only by somebody who actually has them on. A room where captions are off stays silent rather
            // than every participant answering "no" to every arrival at once.
            if (requester && isLiveTranscriptionActive(state)) {
                _send(state, buildCaptionsStateAck(true, requester, getCaptionsStartedBy(state)), requester);
            }
        } else if (isCaptionsStateAck(data)) {
            const ack = data as ICaptionsStateAck;
            const localId = getLocalParticipant(store.getState())?.id;

            // Addressed to somebody else. The answer also goes out on the fallback road, which reaches the room, so
            // this is ordinary rather than suspicious - it simply is not ours to act on.
            if (!ack.targetId || ack.targetId === localId) {
                _applyRemote(store, ack.enabled, ack.startedBy || from);
            }
        } else if (isNoiseSuppression(data)) {
            _onNoiseSuppression(data.enabled);
        } else if (isListenerState(data)) {
            // The authenticated sender, never the identity in the payload: one participant must not be able to hold
            // the room's microphones open in another's name.
            if (from) {
                _setListener(store, from, (data as IListenerState).action === LISTENER_SUBSCRIBE);
            }
        } else if (isTranscript(data)) {
            _onTranscript(store, data as ITranscriptMessage, from);
        }

        return result;
    }

    // Only a moderator tells new arrivals: three announcements from one device is a resend, and three from every
    // device is a broadcast storm.
    case PARTICIPANT_JOINED: {
        const result = next(action);
        const state = store.getState();
        const participantId = action.participant?.id;

        if (participantId
                && !action.participant?.local
                && isLiveTranscriptionActive(state)
                && isLocalParticipantModerator(state)) {
            _announceTo(store, participantId);
        }

        return result;
    }

    // Every device watches for this itself rather than leaving it to the moderators, and deliberately: the participant
    // who started captions may have been the only moderator in the room, in which case a moderator-gated check would
    // leave captions running with nobody able to turn them off.
    case PARTICIPANT_LEFT: {
        const startedBy = getCaptionsStartedBy(store.getState());
        const participantId = action.participant?.id;
        const result = next(action);

        if (participantId) {
            _setListener(store, participantId, false);
        }

        if (startedBy && participantId === startedBy && isLiveTranscriptionActive(store.getState())) {
            logger.info(`${startedBy} started live captions and has left; turning them off`);

            // Marked as a remote sync so that the dispatch does not broadcast on its own - the off state is announced
            // once, below, rather than once here and again from the case which handles the dispatch.
            store.dispatch(setRequestingSubtitles(
                false,
                false,
                store.getState()['features/subtitles']._language,
                false,
                { fromRemoteSync: true }));

            const localId = getLocalParticipant(store.getState())?.id;

            // Re-announced so that a room where several devices notice at slightly different moments converges, rather
            // than half of it staying on because it never saw the departure.
            if (localId) {
                _broadcast(store, false, localId);
            }
        }

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
