import { IReduxState } from '../app/types';
import { isEchoOfSpokenText } from '../caption-tts/spokenText';

import { S2SV2Theme } from './components/native/palettes';
import {
    DEFAULT_SOURCE_LANGUAGE,
    DEFAULT_TARGET_LANGUAGE,
    ECHO_ROOM_LOOKBACK,
    S2S_V2_PANEL_HEIGHT_RATIO
} from './constants';
import { IS2SV2State, IS2SV2TranscriptEntry } from './reducer';

const DEFAULT_STATE: IS2SV2State = {
    enabled: false,
    multipleSpeakersDetected: false,
    showLanguagePopup: false,
    showPanel: false,
    showStopConfirm: false,
    sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    suppressOriginalVoice: true,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    theme: 'dark',
    transcripts: {},
    translating: {},
    speakingMessageId: null
};

/**
 * Returns the state of the feature.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IS2SV2State}
 */
export function getS2SV2State(state: IReduxState): IS2SV2State {
    return state['features/s2s-v2'] ?? DEFAULT_STATE;
}

/**
 * Returns whether a translated session is running.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isS2SV2Active(state: IReduxState): boolean {
    return getS2SV2State(state).enabled;
}

/**
 * Returns the identifier of the running session, if there is one.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string|undefined}
 */
export function getS2SV2SessionId(state: IReduxState): string | undefined {
    return getS2SV2State(state).sessionId;
}

/**
 * Returns the language this device wants to hear everybody in.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string}
 */
export function getS2SV2TargetLanguage(state: IReduxState): string {
    // Older builds persisted an empty string. Treat it as the new default so existing installations get English
    // immediately instead of keeping the loading placeholder until they make a selection themselves.
    return getS2SV2State(state).targetLanguage || DEFAULT_TARGET_LANGUAGE;
}

/**
 * Returns whether this device turns the original voices down underneath the translation.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function shouldSuppressOriginalVoice(state: IReduxState): boolean {
    return getS2SV2State(state).suppressOriginalVoice;
}

/**
 * Returns which of the two ways the panel is drawn.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {S2SV2Theme}
 */
export function getS2SV2Theme(state: IReduxState): S2SV2Theme {
    return getS2SV2State(state).theme;
}

/**
 * Returns whether a language is one the speech service already answers in, so that nothing needs translating.
 *
 * Compared on the base code alone, because the listener may have chosen a language which carries a region while the
 * transcripts never do.
 *
 * @param {string} language - The language to check.
 * @returns {boolean}
 */
export function isEnglish(language?: string): boolean {
    return (language ?? '').toLowerCase().replace(/-/g, '_')
        .split('_')[0] === 'en';
}

/**
 * Returns what has been said so far, oldest first.
 *
 * Ordered by when each utterance was spoken rather than by when it arrived, so that a slow translation on one device
 * cannot reorder the conversation on another.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {IS2SV2TranscriptEntry[]}
 */
export function getS2SV2Transcripts(state: IReduxState): IS2SV2TranscriptEntry[] {
    return Object.values(getS2SV2State(state).transcripts)
        .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Returns whether a transcript this device is about to broadcast is really something somebody else in the room just
 * said, coming back through the microphone.
 *
 * The second half of the echo defence, and the half which catches what the first cannot. What this device reads aloud
 * is remembered as it is spoken, which covers the loudspeaker being heard back; this covers the same sentence arriving
 * by any other route - a remote participant's own voice, turned down to a murmur rather than silenced, picked up off
 * the loudspeaker and transcribed as though the local user had said it. Nothing was read aloud in that case, so there
 * is nothing in the spoken memory to match, and only what the room actually said can recognise it.
 *
 * Compared against the English each utterance arrived as, which is the language a transcript comes back in whatever
 * was heard, so the two sides are the same language by construction.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} text - The transcript about to be broadcast.
 * Answered with the entry it matched rather than with a yes, so that a sentence which never reached the meeting can be
 * read against the line it was held beside instead of guessed at.
 *
 * @param {string} localParticipantId - Whoever this device is, whose own earlier lines are not echoes of anything.
 * @param {boolean} strict - Whether to use the tighter measures, for speech recorded over the loudspeaker.
 * @returns {IS2SV2TranscriptEntry | undefined}
 */
export function findEchoOfRecentSpeech(
        state: IReduxState,
        text: string,
        localParticipantId?: string,
        strict = false): IS2SV2TranscriptEntry | undefined {
    if (!text?.trim()) {
        return undefined;
    }

    return getS2SV2Transcripts(state)
        .slice(-ECHO_ROOM_LOOKBACK)
        .find(entry => entry.speakerId !== localParticipantId
            && isEchoOfSpokenText(text, entry.originalText, strict));
}

/**
 * Returns which language the speech service is told to expect, as the running session announced it.
 *
 * Read from the session rather than assumed, so that a session started by a device which sets it to something other
 * than English is honoured here without a change.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string}
 */
export function getS2SV2SourceLanguage(state: IReduxState): string {
    return getS2SV2State(state).sourceLanguage || DEFAULT_SOURCE_LANGUAGE;
}

/**
 * Returns the websocket endpoint this deployment wants S2S v2 transcription to use, if it overrides the default.
 *
 * The build ships with the Melp production endpoint as the fallback. Deployments which need to point at a different
 * backend can carry a `s2sV2SttUrl` config value without changing the client contract.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string|undefined}
 */
export function getS2SV2TranscriptionUrl(state: IReduxState): string | undefined {
    const config = state['features/base/config'] as { s2sV2SttUrl?: string; } | undefined;

    return config?.s2sV2SttUrl || undefined;
}

/**
 * Returns whether the panel is on screen.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isS2SV2PanelOpen(state: IReduxState): boolean {
    const { enabled, showPanel } = getS2SV2State(state);

    return enabled && showPanel;
}

/**
 * Returns the height the panel takes away from the video, or 0 when it is not on screen.
 *
 * Half the screen, so the conversation and the people having it get the same amount of room. The tile grid is sized
 * from the same number, because it lays itself out from the viewport height and would otherwise be drawn underneath
 * the panel and clipped by it.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {number}
 */
export function getS2SV2PanelHeight(state: IReduxState): number {
    if (!isS2SV2PanelOpen(state)) {
        return 0;
    }

    const { clientHeight = 0 } = state['features/base/responsive-ui'];

    return Math.round(clientHeight * S2S_V2_PANEL_HEIGHT_RATIO);
}

/**
 * Returns whether something this participant said is on its way through translation - either still being translated, or
 * translated already and now being read out.
 *
 * Both halves count, because to anybody watching their tile they are one thing: what this person said is being dealt
 * with and is about to arrive in a language they understand. Stopping the indicator the moment the text comes back,
 * only for the translated voice to start a beat later, would blink it off exactly when it is most worth having.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} participantId - The participant to check.
 * @returns {boolean}
 */
export function isS2SV2ParticipantTranslating(state: IReduxState, participantId: string): boolean {
    const { speakingMessageId, transcripts, translating } = getS2SV2State(state);

    if (Object.values(translating ?? {}).some(speakerId => speakerId === participantId)) {
        return true;
    }

    return Boolean(speakingMessageId)
        && transcripts?.[speakingMessageId as string]?.speakerId === participantId;
}

/**
 * Returns the transcript currently being read aloud, if any.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string | null}
 */
export function getS2SV2SpeakingMessageId(state: IReduxState): string | null {
    return getS2SV2State(state).speakingMessageId;
}
