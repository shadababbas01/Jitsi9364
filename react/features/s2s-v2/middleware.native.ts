import { AnyAction } from 'redux';

import { IReduxState, IStore } from '../app/types';
import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    ENDPOINT_MESSAGE_RECEIVED
} from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { hideSheet, openSheet } from '../base/dialog/actions';
import { SET_AUDIO_MUTED } from '../base/media/actionTypes';
import { PARTICIPANT_JOINED } from '../base/participants/actionTypes';
import {
    getLocalParticipant,
    getParticipantById,
    getParticipantCount,
    getParticipantDisplayName,
    isLocalParticipantModerator,
    isParticipantModerator
} from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import StateListenerRegistry from '../base/redux/StateListenerRegistry';
import { TRACK_ADDED, TRACK_REMOVED, TRACK_UPDATED } from '../base/tracks/actionTypes';
import { STT_LOG_TAG } from '../live-transcribe/constants';
import {
    closeTranscriptionConnection,
    openTranscriptionConnection
} from '../live-transcribe/native/transcribeWav';
import { AUDIO_DEVICE_SPEAKER } from '../mobile/audio-mode/constants';
import { isPrivateAudioDeviceSelected, selectAudioDevice } from '../mobile/audio-mode/functions';
import { hideNotification, showNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE, NOTIFICATION_TYPE } from '../notifications/constants';
import { setSubtitlesPanelOpen } from '../subtitles/actions.any';
import { translateLiveCaptionText } from '../subtitles/languages';
import { carriesParticipant } from '../subtitles/sessionProtocol';
import { setToolboxVisible } from '../toolbox/actions.native';
import { setTileView } from '../video-layout/actions.any';

import {
    BROADCAST_S2S_V2_TRANSCRIPT,
    SET_S2S_V2_LANGUAGE_POPUP,
    SET_S2S_V2_PANEL,
    SET_S2S_V2_STOP_CONFIRM,
    SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE,
    SET_S2S_V2_TARGET_LANGUAGE,
    START_S2S_V2_SESSION,
    STOP_S2S_V2_SESSION
} from './actionTypes';
import {
    addS2SV2Transcript,
    broadcastS2SV2Transcript,
    clearS2SV2Session,
    setS2SV2LanguagePopupVisible,
    setS2SV2Session,
    setS2SV2TranscriptSpeaking,
    setS2SV2TranscriptTranslating,
    setS2SV2TranscriptTranslation,
    stopS2SV2Session
} from './actions';
import DisableS2SV2Dialog from './components/native/DisableS2SV2Dialog';
import S2SV2LanguagePopup from './components/native/S2SV2LanguagePopup';
import {
    DEFAULT_SOURCE_LANGUAGE,
    LATE_JOINER_RESEND_DELAYS_MS,
    MAX_S2S_V2_PARTICIPANTS,
    PLAYBACK_RESEND_DELAYS_MS,
    S2S_V2_MIC_ERROR_UID,
    S2S_V2_TRANSCRIBE_ERROR_UID,
    S2S_V2_TRANSLATING_OFF,
    S2S_V2_TRANSLATING_ON,
    S2S_V2_TRANSLATING_PROPERTY,
    S2S_V2_TTS_ERROR_UID,
    SEND_RETRY_DELAY_MS,
    TRANSLATE_TIMEOUT_MS
} from './constants';
import {
    getS2SV2SessionId,
    getS2SV2SourceLanguage,
    getS2SV2TargetLanguage,
    getS2SV2TranscriptionUrl,
    isEnglish,
    isS2SV2Active
} from './functions';
import logger from './logger';
import S2SV2Capture from './native/S2SV2Capture';
import S2SV2Speaker from './native/S2SV2Speaker';
import {
    cancelVolumeRetries,
    duckAgainShortly,
    duckAll,
    duckTrack,
    resetSpeakingParticipant,
    setSpeakingParticipant
} from './native/ducking';
import { unwatchAll, unwatchTrack, watchAll, watchTrack } from './native/speakerDetection';
import {
    IS2SV2Message,
    IS2SV2Playback,
    IS2SV2SessionEnd,
    IS2SV2SessionStart,
    IS2SV2Transcript,
    ProcessedMessages,
    buildPlayback,
    buildSessionEnd,
    buildSessionStart,
    buildTranscript,
    createMessageIdFactory,
    generateSessionId,
    isPlayback,
    isS2SV2Message,
    isSessionEnd,
    isSessionStart,
    isTranscript
} from './protocol';

/**
 * Keeps the meeting informed whether the local participant is currently having an utterance translated for everybody
 * else.
 *
 * @param {IStore} store - The redux store.
 * @param {boolean} translating - Whether a local utterance is in flight.
 * @returns {void}
 */
function _announceTranslating(store: IStore, translating: boolean) {
    try {
        getCurrentConference(store.getState())?.setLocalParticipantProperty(
            S2S_V2_TRANSLATING_PROPERTY,
            translating ? S2S_V2_TRANSLATING_ON : S2S_V2_TRANSLATING_OFF);
    } catch (error) {
        logger.warn('Could not announce the s2s-v2 translation state', error);
    }
}

/**
 * The utterances which have already been dealt with, so that one redelivered is recognised rather than shown and spoken
 * a second time.
 */
const processed = new ProcessedMessages();

/**
 * The sessions this device has already been told about.
 *
 * The popup opens on the first announcement of a session and never again, because a moderator announces a running
 * session to every new arrival three times over. Without this, the second and third would reopen a popup the user had
 * just dismissed.
 */
const announcedSessions = new Set<string>();

/**
 * Names one outgoing utterance after another.
 */
const nextMessageId = createMessageIdFactory();

/**
 * The announcements still to be made to somebody who has only just arrived, held so that leaving the conference can
 * drop them.
 */
let pendingResends: Array<ReturnType<typeof setTimeout>> = [];

/**
 * The playback reports still to be repeated to a speaker, held for the same reason.
 */
let pendingPlaybackResends: Array<ReturnType<typeof setTimeout>> = [];

/**
 * Which speaker this device last told that it was reading them out, so that the same speaker can be told when it
 * stops. The speech engine announces who it has started on and never who it has finished with.
 */
let playbackReportedFor: string | null = null;

/**
 * Reads translated sentences out loud. Made on the first session and kept afterwards, so that a second session does not
 * wait for the speech engine to start again.
 */
let tts: S2SV2Speaker | undefined;

/**
 * Listens to the microphone and turns what it hears into English text. Made on the first session for the same reason.
 */
let capture: S2SV2Capture | undefined;

/**
 * The layout the meeting was being watched in when the session started, so that it goes back to it afterwards.
 *
 * Undefined is a layout in its own right - the one chosen automatically - so whether there is anything to go back to is
 * a separate question from what to go back to.
 */
let wasTileViewEnabled: boolean | undefined;
let tileViewForced = false;

/**
 * Whether the local user has already been told that something could not be transcribed. Once per session: a service
 * having a bad minute would otherwise raise one notification per sentence.
 */
let transcribeFailureReported = false;

/**
 * Says something on the s2s-v2 channel.
 *
 * Never throws: the data channel to a given participant is frequently not open yet, which is a timing condition rather
 * than a fault, and the local state which the message describes has already been changed. Two roads are tried, and if
 * neither is open the whole thing is tried once more shortly - what somebody said is worth more than one attempt at a
 * channel which is coming back anyway. A session announcement missed on top of that is repeated to whoever arrives.
 *
 * @param {IReduxState} state - The redux state.
 * @param {Object} payload - What to say.
 * @param {string} target - Who to say it to. Everybody, when left out.
 * @param {boolean} retry - Whether to try again shortly if neither road is open. False on the retry itself, so that a
 * meeting which cannot be reached at all is attempted twice rather than forever.
 * @returns {void}
 */
function _send(state: IReduxState, payload: IS2SV2Message, target = '', retry = true) {
    const conference = getCurrentConference(state);

    if (!conference) {
        logger.warn(`Could not send "${payload.action}": there is no conference to send it on`);
        console.log(`[s2s-v2] ${payload.action} NOT sent: no conference`, payload);

        return;
    }

    // Logged whole, and logged before the outcome is known, exactly as an arriving message is. The two together are
    // what make a missing transcript answerable: whether this device sent it at all is the first question, and it has
    // to have an answer without a debugger attached. Said twice for the same reason the receiving side is - the logger
    // reaches the native log, the console reaches the packager, and on React Native those are not the same place.
    logger.info(`Sending "${payload.action}"${target ? ` to ${target}` : ' to the meeting'}`
        + `${retry ? '' : ' (retry)'}: ${JSON.stringify(payload)}`);
    console.log(`[s2s-v2] ${payload.action} sent to ${target || 'the meeting'}${retry ? '' : ' (retry)'}`, payload);

    // The bridge channel first, which is what the web client uses and what the contract names.
    try {
        conference.sendEndpointMessage?.(target, payload);

        return;
    } catch (error) {
        // There is no bridge channel to send it on. Two ordinary situations produce this rather than any fault: a two
        // person call runs peer to peer with no videobridge in the middle to carry an endpoint message at all, and a
        // call which has one has not necessarily opened it yet at the moment somebody joins - which is exactly when a
        // running session has to be announced to them.
        logger.debug(`No bridge channel for "${payload.action}"; going over XMPP instead`);
    }

    try {
        // The same message by the other road. The receiving side cannot tell the difference: a JSON message over XMPP
        // arrives as the same ENDPOINT_MESSAGE_RECEIVED, carrying the same payload and the same sender, which is what
        // makes this a fallback rather than a second protocol. Copied because the library stamps its own marker into
        // whatever object it is handed.
        conference.sendMessage?.({ ...payload }, target, false);
    } catch (error) {
        logger.warn(`Could not send "${payload.action}" to ${target || 'the meeting'}`, error);

        // Neither road was open. Worth one more attempt in a moment rather than losing what somebody said: both roads
        // are unavailable in the same window - a channel which has not opened yet, a connection being re-established -
        // and both are usually back within it. Receivers order transcripts by the timestamp the message carries, so one
        // which arrives late still reads in the place it was spoken.
        if (retry) {
            setTimeout(() => _send(state, payload, target, false), SEND_RETRY_DELAY_MS);
        }
    }
}

/**
 * Tells one speaker that this device has started, or stopped, reading their words out in translation.
 *
 * Said three times over a few seconds rather than once. The channel it goes on has no acknowledgement and is
 * frequently not open at the moment it is wanted, and a report which is lost leaves the speaker believing the opposite
 * of what is true until the next one happens to arrive.
 *
 * Nothing local hangs off this - which participant is turned down, and by how much, is decided on this device from
 * what its own speech engine is doing. It travels for the far side's benefit: a web client sends and expects it, and a
 * speaker who is never told is a speaker whose own screen cannot say they are being heard in translation anywhere.
 *
 * @param {IStore} store - The redux store.
 * @param {string} speakerId - Whose words are being read, or nobody.
 * @param {boolean} playing - Whether the reading is going on right now.
 * @returns {void}
 */
function _reportPlayback(store: IStore, speakerId: string | null) {
    const previous = playbackReportedFor;

    playbackReportedFor = speakerId;

    // Whoever was being read a moment ago has to be told it has stopped, and they are not who the engine is naming
    // now: the engine says who it has started on, and says nothing at all about who it has finished with. Told first,
    // so that a speaker who is followed immediately by another sees the two reports in the order they happened.
    if (previous && previous !== speakerId) {
        _sendPlaybackReliably(store, previous, false);
    }

    if (speakerId) {
        _sendPlaybackReliably(store, speakerId, true);
    }
}

/**
 * Sends one playback report to one speaker, and again twice over the next few seconds.
 *
 * @param {IStore} store - The redux store.
 * @param {string} speakerId - Whose words are being read.
 * @param {boolean} playing - Whether the reading is going on.
 * @returns {void}
 */
function _sendPlaybackReliably({ getState }: IStore, speakerId: string, playing: boolean) {
    const report = () => {
        const state = getState();
        const sessionId = getS2SV2SessionId(state);
        const listenerId = getLocalParticipant(state)?.id;

        if (!sessionId || !listenerId) {
            return;
        }

        _send(state, buildPlayback(sessionId, speakerId, listenerId, playing), speakerId);
    };

    report();

    PLAYBACK_RESEND_DELAYS_MS.forEach(delay => {
        // Each attempt takes itself off the list once it has run, so a long session does not accumulate a timer per
        // sentence for the whole of it.
        const resend: ReturnType<typeof setTimeout> = setTimeout(() => {
            pendingPlaybackResends = pendingPlaybackResends.filter(pending => pending !== resend);
            report();
        }, delay);

        pendingPlaybackResends.push(resend);
    });
}

/**
 * Handles one listener telling this device that it is reading the local participant's words out.
 *
 * Checked rather than trusted, twice over: the report has to belong to the session which is running here, and it has
 * to be about this device. It arrives unicast, but the routing is not what makes it ours to believe.
 *
 * @param {IStore} store - The redux store.
 * @param {IS2SV2Playback} message - What arrived.
 * @returns {void}
 */
function _onPlayback(store: IStore, message: IS2SV2Playback) {
    const state = store.getState();

    if (getS2SV2SessionId(state) !== message.sessionId) {
        return;
    }

    if (message.speakerId !== getLocalParticipant(state)?.id) {
        logger.debug(`Ignored a playback report about ${message.speakerId}, which is not this device`);

        return;
    }

    // Recorded in the log and nowhere else, deliberately. Nothing on this screen is drawn from it today: what is shown
    // about a participant being translated comes from this device's own view of its own speech engine, which cannot be
    // wrong about itself and needs no permission from the network. Accepting the report is what the protocol asks for
    // and what a web client on the other end is entitled to; inventing a second, contradictable source for something
    // already on screen is not.
    logger.info(`${message.listenerId} ${message.playing ? 'started' : 'stopped'} reading this device's words aloud`);
}

/**
 * Starts a translated session and tells the meeting about it.
 *
 * Moderator only. The check is here rather than in the button because hiding a control is not the same as withholding
 * the ability: the receiving side checks as well, and both checks are the rule.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _start(store: IStore) {
    const { dispatch, getState } = store;
    const state = getState();

    if (!isLocalParticipantModerator(state)) {
        logger.warn('Refused to start a session: the local participant is not a moderator');

        return;
    }

    if (isS2SV2Active(state)) {
        return;
    }

    const startedBy = getLocalParticipant(state)?.id;

    if (!startedBy) {
        logger.warn('Refused to start a session: the local participant has no id yet');

        return;
    }

    const sessionId = generateSessionId();

    // Nobody hears their own broadcast, so this device records the session itself rather than waiting to be told about
    // it. Marking the session announced keeps the popup from reopening if one ever did come back.
    announcedSessions.add(sessionId);
    dispatch(setS2SV2Session(sessionId, startedBy, DEFAULT_SOURCE_LANGUAGE));

    _send(getState(), buildSessionStart(sessionId, startedBy, DEFAULT_SOURCE_LANGUAGE));

    const told = getState()['features/base/participants'].remote.size;

    logger.info(`Started session ${sessionId} and announced it to ${told} other participant(s)`);
    console.log(`[s2s-v2] session-start ${sessionId} announced to the meeting (${told} other participant(s))`);

    _sessionUp(store);
    _revealToolbar(store);
}

/**
 * Ends the running session for everybody.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _stop(store: IStore) {
    const { getState } = store;
    const state = getState();

    if (!isLocalParticipantModerator(state)) {
        logger.warn('Refused to end a session: the local participant is not a moderator');

        return;
    }

    const sessionId = getS2SV2SessionId(state);

    if (!sessionId) {
        return;
    }

    _send(state, buildSessionEnd(sessionId));
    logger.info(`Ended session ${sessionId}`);
    _teardown(store);
}

/**
 * Clears everything a session leaves behind on this device.
 *
 * What was said stays on screen. It is the conversation rather than part of the session, and a session ending is not a
 * reason to forget what was in it.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _teardown(store: IStore) {
    const { dispatch } = store;

    // Whether there was anything to tear down. The conference ending runs this whether or not a session was in
    // progress, and giving volumes back which this feature never took would undo whatever else has turned them down -
    // the older 1:1 translation feature sets the same volumes on the same tracks.
    const wasActive = isS2SV2Active(store.getState());

    processed.clear();
    pendingResends.forEach(resend => clearTimeout(resend));
    pendingResends = [];
    pendingPlaybackResends.forEach(resend => clearTimeout(resend));
    pendingPlaybackResends = [];
    playbackReportedFor = null;
    transcribeFailureReported = false;
    _announceTranslating(store, false);

    capture?.stop();

    // Nothing left to transcribe, so the connection which was doing it goes too rather than being held open for the
    // rest of the meeting. Only when there was a session, for the same reason the volumes are: the transcription
    // connection is shared with the older 1:1 translation feature, and closing one it is in the middle of using would
    // cost it the sentence in flight.
    if (wasActive) {
        logger.info(`${STT_LOG_TAG} the session on this device is over; closing the transcription connection`);
        closeTranscriptionConnection();
    }

    cancelVolumeRetries();
    unwatchAll(store);

    // Back to whichever layout the meeting was being watched in before the session took it.
    if (tileViewForced) {
        tileViewForced = false;
        dispatch(setTileView(wasTileViewEnabled));
        wasTileViewEnabled = undefined;
    }

    dispatch(hideNotification(S2S_V2_MIC_ERROR_UID));
    dispatch(hideNotification(S2S_V2_TRANSCRIBE_ERROR_UID));
    dispatch(hideNotification(S2S_V2_TTS_ERROR_UID));
    dispatch(clearS2SV2Session());

    const client = tts;

    if (!wasActive) {
        client?.close();
        resetSpeakingParticipant();

        return;
    }

    if (!client) {
        resetSpeakingParticipant();
        duckAll(store, false);

        return;
    }

    // Somebody is mid-sentence. Cutting them off to give a volume back would lose the end of what they said, so the
    // queue is allowed to finish and the volumes follow it rather than the other way round.
    client.waitUntilIdle().then(() => {
        // Unless a new session started while the last of the old one was still being read out, in which case the
        // volumes belong to that session now and are not ours to give back.
        if (isS2SV2Active(store.getState())) {
            return;
        }

        client.close();
        resetSpeakingParticipant();
        duckAll(store, false);
    });
}

/**
 * Handles being told that a session has started.
 *
 * @param {IStore} store - The redux store.
 * @param {IS2SV2SessionStart} message - What arrived.
 * @param {string} from - Who it arrived from, as the conference reports it.
 * @returns {void}
 */
function _onSessionStart(store: IStore, message: IS2SV2SessionStart, from?: string) {
    const { dispatch } = store;

    if (from && from !== message.startedBy) {
        logger.warn(`Session ${message.sessionId} was announced by ${from} on behalf of ${message.startedBy}`);
    }

    // Only a moderator may start a session, and hiding the control from everybody else is a courtesy rather than the
    // rule: a device which has been modified to send the announcement anyway is refused here.
    //
    // Refused only when there is something to refuse it on, though, and that qualification is the whole difficulty.
    // An announcement reaches a new arrival before the presence which says who anybody is, so at the moment the
    // message most needs to be believed the participant list is frequently empty of the person who sent it. Checking a
    // participant who is not there yet and rejecting on the answer would reject exactly the announcements this exists
    // to protect - a late joiner would sit through the whole session having refused to be told about it.
    //
    // So: known and not a moderator is a refusal; not known yet is not evidence of anything and is let through with a
    // line in the log. That is weaker than refusing outright, and deliberately - the cost of the gap is a translated
    // session nobody asked for, which any moderator can end, against the cost of the strict form, which is a
    // participant silently excluded from a legitimate one.
    const announcer = message.startedBy
        && getParticipantById(store.getState(), message.startedBy);

    if (announcer && !isParticipantModerator(announcer)) {
        logger.warn(`Refused session ${message.sessionId}: ${message.startedBy} is not a moderator`);
        console.log(`[s2s-v2] session-start ${message.sessionId} refused: announcer is not a moderator`);

        return;
    }

    if (message.startedBy && !announcer) {
        logger.info(`Session ${message.sessionId} was announced by ${message.startedBy}, who is not in the `
            + 'participant list yet; accepting it rather than refusing a session which has not arrived in presence');
    }

    const first = !announcedSessions.has(message.sessionId);

    const outcome = first ? 'first time - opening the panel' : 'already known - leaving the panel as it is';

    const starter = message.startedBy || 'an unknown participant';

    logger.info(`Session start: ${message.sessionId} from ${starter}, `
        + `source language ${message.sourceLanguage || DEFAULT_SOURCE_LANGUAGE}, ${outcome}`);
    console.log(`[s2s-v2] session-start ${message.sessionId} from ${starter}: ${outcome}`);

    announcedSessions.add(message.sessionId);
    dispatch(setS2SV2Session(
        message.sessionId,
        message.startedBy,
        message.sourceLanguage || DEFAULT_SOURCE_LANGUAGE));

    _sessionUp(store);

    // Only the first time. A moderator announces a running session to each new arrival three times over, and the
    // second and third would otherwise reopen a popup which had just been dismissed and reopen a panel which had just
    // been put away.
    if (first) {
        // The sheet first, and only the sheet. Which language somebody wants to be listening in is the one question a
        // session cannot answer for them, and it is worth asking before the conversation starts arriving rather than
        // over the top of it. The panel follows from the answer: proceeding opens it, and turning the sheet down opens
        // nothing - the session carries on regardless, because dismissing the sheet is declining to choose a language,
        // not declining the session. The button on the video screen is there either way for whoever changes their mind.
        _revealToolbar(store);
        dispatch(setS2SV2LanguagePopupVisible(true));
    }
}

/**
 * Handles being told that a session is over.
 *
 * @param {IStore} store - The redux store.
 * @param {IS2SV2SessionEnd} message - What arrived.
 * @returns {void}
 */
function _onSessionEnd(store: IStore, message: IS2SV2SessionEnd) {
    // A session which is not the one running here has already ended, and saying so again is not news.
    if (getS2SV2SessionId(store.getState()) !== message.sessionId) {
        return;
    }

    logger.info(`Session ${message.sessionId} was ended by the moderator`);
    _teardown(store);

    // Said after the teardown, which clears the notifications a session raised: told before, this would be one of them.
    // Worth saying at all because the panel closing on its own is otherwise indistinguishable from it having crashed.
    store.dispatch(showNotification({
        descriptionKey: 's2sV2.notify.sessionEnded',
        titleKey: 's2sV2.panel.title'
    }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
}

/**
 * Handles one utterance from somebody else.
 *
 * @param {IStore} store - The redux store.
 * @param {IS2SV2Transcript} message - What arrived.
 * @returns {void}
 */
function _onTranscript(store: IStore, message: IS2SV2Transcript) {
    const { dispatch, getState } = store;
    let state = getState();

    // Their own utterance, come back to them. A broadcast does not return to its sender over the bridge channel, but
    // the same message sent to the room over XMPP does, and without this the device which spoke would show every
    // utterance of its own twice. Asked before anything else, so that a device cannot join a session on the strength
    // of hearing itself.
    if (message.speakerId === getLocalParticipant(state)?.id) {
        return;
    }

    // Somebody else's feature, wearing this one's name.
    //
    // Live Speech Translation publishes its transcripts under the same name and action as a translated session, which
    // is a compatibility decision made on the wire and not one this side gets to revisit. The two must not be confused
    // for each other, because the consequence is audible: a translated session reads what arrives out loud, and a
    // caption transcript read out loud is a sentence nobody asked to hear, spoken over the person still saying it, out
    // of a loudspeaker whose microphone is open.
    //
    // The active session identifier is authoritative. Some compatible S2S senders enrich genuine session transcripts
    // with the same participant metadata used by the captions flow, so the presence of that block alone cannot reject
    // a message which belongs to the session running here. It remains useful for keeping an unrelated caption
    // transcript from making this device join a second session when no matching S2S session is active.
    if (carriesParticipant(message) && getS2SV2SessionId(state) !== message.sessionId) {
        logger.debug('Ignored a Live Speech Translation transcript: it belongs to the captions flow, not to a session');

        return;
    }

    // A transcript is proof that a session is running, and better proof than the announcement of one: it is the thing
    // the announcement was about. A device which never received the announcement - it was sent before it arrived, or
    // sent on a channel which was not open, or the moderator who would have resent it has since left - would otherwise
    // sit through the whole session dropping every word of it on a session identifier it was never told.
    //
    // So the session is taken from the transcript and joined exactly as though the announcement had arrived: state
    // recorded, capture and speech started, the toolbar brought back, the panel opened. Marked against the same
    // identifier as an announcement would be, so the announcement arriving late finds the session already joined and
    // does not open a second time over the top of it.
    if (!isS2SV2Active(state)) {
        logger.info(`Joining session ${message.sessionId} from a transcript: its start was never received here`);
        console.log(`[s2s-v2] no session locally - joining ${message.sessionId} from an arriving transcript`);

        // Who started it is not in a transcript and is not worth guessing at: the speaker is whoever is talking, not
        // whoever turned the session on. Recorded as unknown, which is what it is, and which nothing depends on -
        // announcing a session to a new arrival names the device doing the announcing, not the one in this field.
        _onSessionStart(store, buildSessionStart(
            message.sessionId,
            '',
            message.sourceLanguage || DEFAULT_SOURCE_LANGUAGE));

        state = getState();
    }

    // Belongs to a session which is not the one running here, which means it belongs to one which has already ended.
    if (getS2SV2SessionId(state) !== message.sessionId) {
        return;
    }

    // Checked and remembered in one step: a check followed by a separate insert leaves a window in which the same
    // utterance is admitted twice and spoken twice.
    if (!processed.add(message.messageId)) {
        return;
    }

    // What was said goes up straight away, in English. The translation follows onto the same line when it arrives, so
    // that a slow translation delays the translation rather than the utterance.
    dispatch(addS2SV2Transcript(
        message.messageId,
        message.speakerId,
        getParticipantDisplayName(state, message.speakerId),
        message.originalText,
        message.timestamp || Date.now()));

    const targetLanguage = getS2SV2TargetLanguage(state);

    // Already in the language this listener asked for. Nothing to translate, and nothing to add underneath it.
    if (isEnglish(targetLanguage) || !targetLanguage) {
        _speak(store, message, message.originalText, targetLanguage);

        return;
    }

    dispatch(setS2SV2TranscriptTranslating(message.messageId, message.speakerId, true));
    _translate(state, message.originalText, targetLanguage)
        .then(translated => {
            if (getS2SV2SessionId(getState()) !== message.sessionId) {
                return;
            }

            dispatch(setS2SV2TranscriptTranslation(message.messageId, translated));
            _speak(store, message, translated, targetLanguage);
        })
        .finally(() => {
            if (getS2SV2SessionId(getState()) !== message.sessionId) {
                return;
            }

            dispatch(setS2SV2TranscriptTranslating(message.messageId, message.speakerId, false));
        });
}

/**
 * Ends S2S-v2 when the meeting grows beyond the supported participant limit.
 */
StateListenerRegistry.register(
    /* selector */ getParticipantCount,
    /* listener */ (participantCount: number, store: IStore, previousParticipantCount: number) => {
        if (participantCount <= MAX_S2S_V2_PARTICIPANTS
                || previousParticipantCount > MAX_S2S_V2_PARTICIPANTS
                || !isS2SV2Active(store.getState())
                || !isLocalParticipantModerator(store.getState())) {
            return;
        }

        store.dispatch(stopS2SV2Session());
    }
);

/**
 * Turns one utterance into the language this listener asked for.
 *
 * Never rejects. A translation which cannot be had is answered with the English it was given: the utterance is shown
 * and spoken as it was said rather than dropped, because somebody said it and the room is waiting on it.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} text - The English transcript.
 * @param {string} targetLanguage - What to turn it into.
 * @returns {Promise<string>}
 */
function _translate(state: IReduxState, text: string, targetLanguage: string): Promise<string> {
    // The request carries no deadline of its own, and one which never answers would otherwise leave the line reading
    // "Translating…" for good and never reach the speech engine at all. The losing side of the race is left to finish
    // in its own time and ignored.
    const giveUp = new Promise<string>(resolve => {
        setTimeout(() => {
            logger.warn('A translation did not arrive in time; falling back to what was said');
            resolve(text);
        }, TRANSLATE_TIMEOUT_MS);
    });

    const translating = translateLiveCaptionText(text, targetLanguage, state['features/base/jwt'].jwt)
        .then(translated => {
            // What the service answers when it has no translation to give. It is not a translation, and treating it as
            // one would put it on screen and read it out loud.
            if (!translated || translated.trim() === 'TRANS-404') {
                logger.warn('No translation was available; falling back to what was said');

                return text;
            }

            return translated;
        })
        .catch(error => {
            logger.warn('Could not translate an utterance; falling back to what was said', error);

            return text;
        });

    return Promise.race([ translating, giveUp ]);
}

/**
 * Returns the speech client, making it on first use.
 *
 * @param {IStore} store - The redux store.
 * @returns {S2SV2Speaker}
 */
function _getTts(store: IStore): S2SV2Speaker {
    if (tts) {
        return tts;
    }

    tts = new S2SV2Speaker({
        getState: store.getState,

        // A service which cannot speak is not a session which cannot run: the transcript still says what was said, in
        // the listener's own language, which is worth more than nothing at all.
        onError: () => store.dispatch(showNotification({
            appearance: NOTIFICATION_TYPE.WARNING,
            descriptionKey: 's2sV2.error.ttsUnavailable',
            titleKey: 's2sV2.panel.title',
            uid: S2S_V2_TTS_ERROR_UID
        }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM)),

        // Keep capture live while speech is played so the local participant can interrupt or answer. Native acoustic
        // echo cancellation and the transcript echo filter prevent the synthesized line from being sent back.
        onSpeakingChange: (speakerId: string | null, messageId: string | null) => {
            setSpeakingParticipant(store, speakerId);

            // Told, not obeyed. The microphone stays open throughout - this only lets the capture know which of its
            // utterances were recorded over a loudspeaker and could therefore be echoes of it.
            capture?.setPlaying(Boolean(speakerId));
            _reportPlayback(store, speakerId);
            store.dispatch(setS2SV2TranscriptSpeaking(messageId));
        }
    });

    return tts;
}

/**
 * Returns the microphone capture, making it on first use.
 *
 * @param {IStore} store - The redux store.
 * @returns {S2SV2Capture}
 */
function _getCapture(store: IStore): S2SV2Capture {
    if (capture) {
        return capture;
    }

    capture = new S2SV2Capture(store, {

        // A participant who cannot be transcribed is not in the session, whatever the panel says, so this device leaves
        // it rather than sitting in one looking like it is taking part.
        onMicUnavailable: () => {
            store.dispatch(showNotification({
                appearance: NOTIFICATION_TYPE.ERROR,
                descriptionKey: 's2sV2.error.micBlocked',
                titleKey: 's2sV2.panel.title',
                uid: S2S_V2_MIC_ERROR_UID
            }, NOTIFICATION_TIMEOUT_TYPE.STICKY));
            _teardown(store);
        },

        // Once, not once per sentence. A service having a bad minute would otherwise bury the meeting in notifications
        // about it.
        onTranscribeFailed: () => {
            if (transcribeFailureReported) {
                return;
            }

            transcribeFailureReported = true;
            store.dispatch(showNotification({
                appearance: NOTIFICATION_TYPE.WARNING,
                descriptionKey: 's2sV2.error.transcribeFailed',
                titleKey: 's2sV2.panel.title',
                uid: S2S_V2_TRANSCRIBE_ERROR_UID
            }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
        },

        onTranscript: (text: string) => store.dispatch(broadcastS2SV2Transcript(text))
    });

    return capture;
}

/**
 * Warns the local user once when the speech service has not advertised a voice for the language they chose.
 *
 * The service, not this device, is what has to have a voice: melp's Piper speaks over its own connection rather than
 * through whatever the phone happens to have installed, so a missing voice here is the service not (yet) supporting
 * the language rather than something the local user can fix. Nothing is changed on their behalf: the transcript is
 * still translated and still on screen, and which language they read in is theirs to pick.
 *
 * @param {IStore} store - The redux store.
 * @param {string} language - The language they chose.
 * @returns {void}
 */
function _warnIfUnspeakable(store: IStore, language: string) {
    _getTts(store).canSpeak(language).then(available => {
        if (available) {
            store.dispatch(hideNotification(S2S_V2_TTS_ERROR_UID));

            return;
        }

        store.dispatch(showNotification({
            appearance: NOTIFICATION_TYPE.WARNING,
            descriptionKey: 's2sV2.error.languageUnavailableDescription',
            titleKey: 's2sV2.error.languageUnavailable',
            uid: S2S_V2_TTS_ERROR_UID
        }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
    });
}

/**
 * Brings the meeting toolbar back, so that the control for the session is somewhere the local user can see it.
 *
 * The button which shows and hides the panel lives on the side toolbar, and the side toolbar is faded out and
 * untouchable for as long as the meeting toolbar has timed out. A session beginning while it is hidden would put the
 * one control for it somewhere there is no reason to look. It goes away again on its own timer afterwards, exactly as
 * it would have done, so this brings it to the local user's attention once rather than pinning it open.
 *
 * Called once per session and not once per announcement: a running session is announced again to every new arrival,
 * and bringing the toolbar back at two seconds and again at five would be taking it back off somebody who had just put
 * it away.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _revealToolbar({ dispatch }: IStore) {
    dispatch(setToolboxVisible(true));
}

/**
 * Brings the session up on this device: the microphone, the speech connection, the volumes and the audio levels which
 * say whether two people are talking at once.
 *
 * Run identically on the moderator who started the session and on everybody who was told about it. Once a session is
 * running it belongs to the room, and the device which started it is not a different kind of participant in it.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function _sessionUp(store: IStore) {
    // Opened with the session rather than by the first thing anybody says, so that the connection is already there when
    // a one second pause hands the first utterance over. It stays up for the length of the session and puts itself back
    // if it drops.
    logger.info(`${STT_LOG_TAG} a session is up on this device; opening the transcription connection`);
    openTranscriptionConnection({
        baseUrl: getS2SV2TranscriptionUrl(store.getState()),
        jwt: store.getState()['features/base/jwt'].jwt,
        language: getS2SV2SourceLanguage(store.getState())
    });

    _getTts(store).open();
    _getCapture(store).sync();

    // Everybody in the room, then again in a moment: a track which has only just been added is not playing yet, and a
    // volume set on an audio sink which does not exist is dropped rather than kept for when it does.
    duckAll(store, true);
    duckAgainShortly(store);

    watchAll(store);

    const targetLanguage = getS2SV2TargetLanguage(store.getState());

    if (targetLanguage && !isEnglish(targetLanguage)) {
        _warnIfUnspeakable(store, targetLanguage);
    }
}

/**
 * Reads one line out loud, in the language this listener asked for.
 *
 * @param {IStore} store - The redux store.
 * @param {IS2SV2Transcript} message - The utterance it belongs to.
 * @param {string} text - What to say.
 * @param {string} language - Which language it is in.
 * @returns {void}
 */
function _speak(store: IStore, message: IS2SV2Transcript, text: string, language: string) {
    const state = store.getState();

    if (!isS2SV2Active(state)) {
        return;
    }

    _getTts(store).speak({
        // Somebody who turned the sheet down never picked a language. They are still in the session and still hear it,
        // in the language it was said in, because dismissing the sheet is not declining the session.
        language: language || message.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
        messageId: message.messageId,
        originalText: message.originalText,
        speakerId: message.speakerId,
        text,
        timestamp: message.timestamp || Date.now()
    });
}

/**
 * Sends one finished utterance to the meeting, and shows it here at the same moment.
 *
 * Not gated on the role. A session is started by a moderator and then belongs to the room: once it is running, anybody
 * in it may speak and be translated.
 *
 * @param {IStore} store - The redux store.
 * @param {string} originalText - The English transcript of what was said.
 * @returns {void}
 */
function _broadcastTranscript(store: IStore, originalText: string) {
    const { dispatch, getState } = store;
    const state = getState();
    const sessionId = getS2SV2SessionId(state);
    const speakerId = getLocalParticipant(state)?.id;
    const text = (originalText ?? '').trim();

    if (!sessionId || !speakerId || !text) {
        return;
    }

    const messageId = nextMessageId();
    const timestamp = Date.now();

    // Locally first, and without waiting: a broadcast does not come back to whoever sent it, so nothing else is going
    // to put this on the speaker's own screen.
    dispatch(addS2SV2Transcript(
        messageId,
        speakerId,
        getParticipantDisplayName(state, speakerId),
        text,
        timestamp));

    _send(state, buildTranscript(sessionId, messageId, speakerId, text, timestamp));
    logger.info(`Sent ${messageId} to the meeting: ${text}`);

    const targetLanguage = getS2SV2TargetLanguage(state);

    // And the speaker's own line is translated here for the same reason it is shown here: nothing is coming back to do
    // it for them. Without this the line they just said sits under "Translating…" for the rest of the meeting, because
    // the panel has no way of telling a translation which is on its way from one which was never asked for.
    //
    // Read on screen but deliberately not read aloud. The one person who does not need their own words spoken back to
    // them is whoever just said them, and speaking them would also feed this device's own voice back into its
    // microphone.
    if (targetLanguage && !isEnglish(targetLanguage)) {
        dispatch(setS2SV2TranscriptTranslating(messageId, speakerId, true));
        _announceTranslating(store, true);

        _translate(state, text, targetLanguage)
            .then(translated => dispatch(setS2SV2TranscriptTranslation(messageId, translated)))
            .finally(() => {
                if (getS2SV2SessionId(getState()) !== sessionId) {
                    return;
                }

                dispatch(setS2SV2TranscriptTranslating(messageId, speakerId, false));
                _announceTranslating(store, false);
            });
    }
}

/**
 * Tells somebody who has only just arrived that a session is already running.
 *
 * A session is announced once, when it starts, and is not part of the conference state a new device is handed, so
 * without this a late arrival would never learn of it. Said three times because the data channel to a participant is
 * frequently not open at the moment they appear, and checked again each time because the session may have ended in
 * between.
 *
 * @param {IStore} store - The redux store.
 * @param {string} participantId - Who has arrived.
 * @returns {void}
 */
function _announceTo({ getState }: IStore, participantId: string) {
    const announce = () => {
        const state = getState();
        const sessionId = getS2SV2SessionId(state);

        if (!isS2SV2Active(state) || !sessionId || !isLocalParticipantModerator(state)) {
            return;
        }

        const startedBy = getLocalParticipant(state)?.id;

        if (startedBy) {
            _send(state, buildSessionStart(sessionId, startedBy, getS2SV2SourceLanguage(state)), participantId);
        }
    };

    announce();

    LATE_JOINER_RESEND_DELAYS_MS.forEach(delay => {
        pendingResends.push(setTimeout(announce, delay));
    });
}

/**
 * The s2s-v2 protocol: which device may start and stop a translated session, how one is announced to the meeting and to
 * whoever arrives afterwards, and what happens to each utterance that crosses the channel.
 *
 * Everything on the wire here is matched against a shipped web client, so the message shapes are a contract rather than
 * an implementation detail. Two things deliberately never travel: which language a listener wants to hear, and whether
 * they turn the original voices down. Both are decided on the device doing the listening, which is what lets ten
 * listeners in ten languages cost one message rather than ten.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => next => (action: AnyAction) => {
    switch (action.type) {
    // Nothing but a line in the log. The transcription connection is not opened here on purpose - with no session
    // running there is nothing to transcribe - but somebody reading a log from the moment they joined should be told
    // that, rather than being left to wonder why there is no connection in it yet.
    case CONFERENCE_JOINED: {
        const result = next(action);

        logger.info(`${STT_LOG_TAG} joined the call; the transcription connection opens when a session starts`);

        return result;
    }

    case START_S2S_V2_SESSION: {
        _start(store);

        return next(action);
    }

    case STOP_S2S_V2_SESSION: {
        _stop(store);

        return next(action);
    }

    case BROADCAST_S2S_V2_TRANSCRIPT: {
        const result = next(action);

        _broadcastTranscript(store, action.originalText);

        return result;
    }

    // The sheet follows the state rather than being opened from wherever happens to decide it should be: a session
    // announced by a moderator, a moderator reaching for it themselves and a user turning it down all set the same flag,
    // and this is the one place which puts it on screen or takes it away.
    case SET_S2S_V2_LANGUAGE_POPUP: {
        const result = next(action);

        if (action.visible) {
            // Started here rather than when the first sentence arrives, so that the engine is awake by the time there
            // is something to say: the first utterance of a session would otherwise wait for it.
            _getTts(store).open();
        } else if (!isS2SV2Active(store.getState())) {
            // Turned down without starting anything, so nothing is going to be read out.
            tts?.close();
        }

        store.dispatch(action.visible ? openSheet(S2SV2LanguagePopup) : hideSheet());

        return result;
    }

    // Changed where it stands, taking effect on the next sentence, with no save step and no word to anybody. The
    // engine is asked whether it can actually say this language, because one it has no voice for is not refused - it
    // is simply not spoken, which a listener cannot tell apart from nobody talking.
    case SET_S2S_V2_TARGET_LANGUAGE: {
        const result = next(action);

        if (isS2SV2Active(store.getState())) {
            // Whatever was already playing, or waiting to, was synthesized for the language just left behind - it
            // must not keep going, or arrive late, in a language nobody asked to hear any more. Unlike disabling the
            // feature, which finishes what is queued first, this is an immediate cut: the two are asked for
            // differently and are not the same operation with different timing.
            tts?.interruptForLanguageChange();

            if (action.targetLanguage && !isEnglish(action.targetLanguage)) {
                _warnIfUnspeakable(store, action.targetLanguage);
            }
        }

        return result;
    }

    // The panel is drawn in the room the tile grid gives up for it, and only in that layout: opening it in any other
    // would open a panel nobody can see. Handled here rather than at each of the four places which open one - a late
    // arrival being shown the session, a moderator starting it, somebody answering the sheet, and the button on the
    // video screen - so that none of them can be the one which forgets.
    //
    // The layout is remembered once per session, not once per opening, because a running session is announced again to
    // every new arrival and the second telling would otherwise record the layout the first one changed. It is kept for
    // as long as the session runs: putting the panel away and taking the meeting back to a different layout underneath
    // it would be answering a question nobody asked.
    case SET_S2S_V2_PANEL: {
        const result = next(action);
        const state = store.getState();

        if (action.visible && isS2SV2Active(state)) {
            // The two panels are mutually exclusive. Both are drawn in the room the tile grid gives up for them, so
            // opening one over the other would leave the meeting with two half-screen panels and no video between
            // them. The live captions side does the same in return when it opens.
            store.dispatch(setSubtitlesPanelOpen(false));

            if (!tileViewForced) {
                tileViewForced = true;
                wasTileViewEnabled = state['features/video-layout'].tileViewEnabled;
            }

            store.dispatch(setTileView(true));

            // Translated speech is read out of this device while the room carries on talking, and a listener with the
            // panel open is holding the phone in front of them to read it rather than against their ear: on the
            // earpiece, the translation is the one thing they cannot hear. The route is left where it is once it has
            // been moved - putting the panel away does not stop the reading, so it must not take the loudspeaker away
            // either - and the toolbar's audio route button follows the change of its own accord, because it draws
            // itself from whichever route native reports as selected.
            //
            // A headset is left alone. Somebody wearing one is already hearing the translation privately, and moving
            // them to the loudspeaker would play the meeting to whoever happens to be standing around them.
            if (!isPrivateAudioDeviceSelected(state)) {
                selectAudioDevice(AUDIO_DEVICE_SPEAKER);
            }
        }

        return result;
    }

    // The two local preferences take effect where they are, on the next sentence, without a save step and without a
    // word to anybody: what one listener hears is nobody else's business.
    case SET_S2S_V2_SUPPRESS_ORIGINAL_VOICE: {
        const result = next(action);

        if (isS2SV2Active(store.getState())) {
            duckAll(store, true);
        }

        return result;
    }

    // The confirmation follows the state for the same reason the sheet does: the button which asks for it and the
    // dialog which answers it should not each have to know how the other is put on screen.
    case SET_S2S_V2_STOP_CONFIRM: {
        const result = next(action);

        store.dispatch(action.visible ? openSheet(DisableS2SV2Dialog) : hideSheet());

        return result;
    }

    // One microphone, not two: the local voice reaches the meeting and is transcribed for translation off the same
    // track, so muting has to stop both. Watching the conference mute rather than a button catches every other way of
    // being muted as well, a moderator muting the room among them.
    case SET_AUDIO_MUTED: {
        const result = next(action);

        if (isS2SV2Active(store.getState())) {
            capture?.sync();
        }

        return result;
    }

    // A participant who joins, or whose track is swapped when the call moves between peer to peer and the bridge, is
    // heard through audio this device has not turned down yet, so each track is caught as it appears. Unmuting can hand
    // a track a new audio sink, which starts at the volume the bridge gave it rather than the one asked for here.
    case TRACK_ADDED:
    case TRACK_UPDATED: {
        const result = next(action);
        const state = store.getState();

        if (isS2SV2Active(state)) {
            duckTrack(state, action.track?.jitsiTrack, true);
            watchTrack(store, action.track?.jitsiTrack);
            capture?.sync();
        }

        return result;
    }

    case TRACK_REMOVED: {
        const result = next(action);

        if (isS2SV2Active(store.getState())) {
            unwatchTrack(store, action.track?.jitsiTrack);
            capture?.sync();
        }

        return result;
    }

    case ENDPOINT_MESSAGE_RECEIVED: {
        const result = next(action);
        const { data, participant } = action;

        // The channel is shared. Anything which is not ours is somebody else's message rather than a fault, so it goes
        // by without comment.
        if (isS2SV2Message(data)) {
            const from = participant?.getId?.();

            // Logged before anything is decided about it, and logged whole. Every question worth asking about this
            // feature starts with whether the message arrived at all, and the answer has to be visible without a
            // debugger attached.
            //
            // Said twice on purpose. The logger reaches the native log, which is where it belongs and where it is kept;
            // the console reaches whoever is watching the packager, which is where somebody debugging this is actually
            // looking. On React Native the two are not the same place - the console transport is deliberately taken off
            // the logger at startup - so a message sent only to one of them is invisible from the other.
            logger.info(`Received "${data.action}" from ${from ?? 'an unknown participant'}: ${JSON.stringify(data)}`);
            console.log(`[s2s-v2] ${data.action} received from ${from ?? 'unknown'}`, data);

            if (isSessionStart(data)) {
                _onSessionStart(store, data, from);
            } else if (isSessionEnd(data)) {
                _onSessionEnd(store, data);
            } else if (isTranscript(data)) {
                _onTranscript(store, data);
            } else if (isPlayback(data)) {
                _onPlayback(store, data);
            } else {
                logger.debug(`Ignored a malformed "${data.action}" message`);
            }
        }

        return result;
    }

    // Only the moderator's device tells new arrivals about a running session. Everybody else does nothing here: three
    // announcements from one device is a resend, and three from every device is a broadcast storm.
    case PARTICIPANT_JOINED: {
        const result = next(action);
        const state = store.getState();
        const participantId = action.participant?.id;

        if (participantId
                && !action.participant?.local
                && isS2SV2Active(state)
                && isLocalParticipantModerator(state)) {
            _announceTo(store, participantId);
        }

        return result;
    }

    case CONFERENCE_FAILED:
    case CONFERENCE_LEFT: {
        const result = next(action);

        announcedSessions.clear();
        _teardown(store);

        return result;
    }
    }

    return next(action);
});
