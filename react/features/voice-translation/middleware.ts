import { AnyAction } from 'redux';

import { IStore } from '../app/types';
import { ENDPOINT_MESSAGE_RECEIVED } from '../base/conference/actionTypes';
import { getCurrentConference } from '../base/conference/functions';
import { PARTICIPANT_JOINED, PARTICIPANT_LEFT } from '../base/participants/actionTypes';
import { getLocalParticipant, isLocalParticipantModerator } from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { dismissTranscriptionConsent } from '../chat/actions.any';
import { showWarningNotification } from '../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../notifications/constants';
import { setRequestingSubtitles } from '../subtitles/actions.any';

import {
    DISABLE_VOICE_TRANSLATION,
    ENABLE_VOICE_TRANSLATION,
    SET_PARTICIPANT_TRANSLATING,
    SET_TRANSLATION_PREFERENCES
} from './actionTypes';
import {
    disableVoiceTranslation,
    enableVoiceTranslation,
    setAllowedParticipantId,
    setParticipantTranslating,
    setParticipantTranslationPreferences,
    setVoiceTranslationPopupVisible
} from './actions';
import { MAX_VOICE_TRANSLATION_PARTICIPANTS, VOICE_TRANSLATION_ENDPOINT } from './constants';
import {
    getLocalTranslationPreferences,
    getVoiceTranslationState,
    isVoiceTranslationAvailable,
    isVoiceTranslationEnabled,
    isVoiceTranslationLimitExceeded
} from './functions';
import { ITranslationPreferences } from './reducer';

function buildPreferencesPayload(preferences: ITranslationPreferences, participantId?: string) {
    return {
        name: VOICE_TRANSLATION_ENDPOINT,
        action: 'preferences',
        participantId,
        preferences
    };
}

function buildEnablePayload(participantId?: string) {
    return {
        name: VOICE_TRANSLATION_ENDPOINT,
        action: 'enable',
        participantId
    };
}

function buildDisablePayload(participantId?: string, reason?: string) {
    return {
        name: VOICE_TRANSLATION_ENDPOINT,
        action: 'disable',
        participantId,
        reason
    };
}

function buildRequestPreferencesPayload(participantId?: string) {
    return {
        name: VOICE_TRANSLATION_ENDPOINT,
        action: 'request-preferences',
        participantId
    };
}

function buildTranslatingPayload(participantId: string, translating: boolean) {
    return {
        name: VOICE_TRANSLATION_ENDPOINT,
        action: 'translating',
        participantId,
        translating
    };
}

MiddlewareRegistry.register((store: IStore) => (next: Function) => (action: AnyAction) => {
    const result = next(action);
    const state = store.getState();
    const conference = getCurrentConference(state);

    switch (action.type) {
    case ENABLE_VOICE_TRANSLATION: {
        if (action.broadcast && isLocalParticipantModerator(state)) {
            try {
                const localParticipant = getLocalParticipant(state);
                const target = action.targetParticipantId ?? '';

                conference?.sendEndpointMessage?.(target, buildEnablePayload(localParticipant?.id));

                if (action.targetParticipantId) {
                    store.dispatch(setAllowedParticipantId(action.targetParticipantId));
                }
            } catch (_) {
                // Local state is already updated; late joiners are synced below.
            }
        }
        break;
    }

    case DISABLE_VOICE_TRANSLATION: {
        if (action.broadcast && isLocalParticipantModerator(state)) {
            try {
                const localParticipant = getLocalParticipant(state);

                conference?.sendEndpointMessage?.('', buildDisablePayload(localParticipant?.id, action.reason));
            } catch (_) {
                // The bridge channel can be closed while the conference is leaving.
            }
        }

        store.dispatch(dismissTranscriptionConsent());
        store.dispatch(setRequestingSubtitles(false, false, null));
        break;
    }

    case SET_TRANSLATION_PREFERENCES: {
        try {
            const localParticipant = getLocalParticipant(state);

            conference?.sendEndpointMessage?.(
                '',
                buildPreferencesPayload(action.preferences, localParticipant?.id)
            );
        } catch (_) {
            // The data channel may not be ready yet.
        }
        break;
    }

    case SET_PARTICIPANT_TRANSLATING: {
        if (action.broadcast && conference) {
            try {
                conference.sendEndpointMessage(
                    '',
                    buildTranslatingPayload(action.participantId, Boolean(action.translating))
                );
            } catch (_) {
                // The data channel may not be ready yet.
            }
        }
        break;
    }

    case PARTICIPANT_JOINED: {
        if (!conference || !isVoiceTranslationEnabled(state)) {
            break;
        }

        if (isLocalParticipantModerator(state) && isVoiceTranslationLimitExceeded(state)) {
            store.dispatch(disableVoiceTranslation({ reason: 'participant-limit' }));
            store.dispatch(showWarningNotification({
                titleKey: 'notify.voiceTranslationLimitTitle',
                descriptionKey: 'notify.voiceTranslationLimitDescription',
                descriptionArguments: { max: MAX_VOICE_TRANSLATION_PARTICIPANTS }
            }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
            break;
        }

        const participantId = action.participant?.id;
        const localParticipant = getLocalParticipant(state);
        const { allowedParticipantId } = getVoiceTranslationState(state);

        if (!participantId || (allowedParticipantId && participantId !== allowedParticipantId)) {
            break;
        }

        const sendStateToNewParticipant = () => {
            const currentState = store.getState();

            if (!isVoiceTranslationEnabled(currentState)) {
                return;
            }

            const { allowedParticipantId: allowed } = getVoiceTranslationState(currentState);

            if (allowed && participantId !== allowed) {
                return;
            }

            try {
                conference.sendEndpointMessage(participantId, buildEnablePayload(localParticipant?.id));

                const localPreferences = getLocalTranslationPreferences(currentState);

                if (localPreferences?.fromLanguage || localPreferences?.toLanguage) {
                    conference.sendEndpointMessage(
                        participantId,
                        buildPreferencesPayload(localPreferences, localParticipant?.id)
                    );
                }

                if (isLocalParticipantModerator(currentState)) {
                    const { participantPreferences } = getVoiceTranslationState(currentState);

                    if (!participantPreferences?.[participantId]) {
                        conference.sendEndpointMessage(
                            participantId,
                            buildRequestPreferencesPayload(localParticipant?.id)
                        );
                    }
                }
            } catch (_) {
                // Retry below covers the usual data-channel timing window.
            }
        };

        sendStateToNewParticipant();
        setTimeout(sendStateToNewParticipant, 2000);
        setTimeout(sendStateToNewParticipant, 5000);
        break;
    }

    case PARTICIPANT_LEFT: {
        if (isVoiceTranslationEnabled(state) && !isVoiceTranslationAvailable(state)) {
            store.dispatch(disableVoiceTranslation({ reason: 'participant-left' }));
        }
        break;
    }

    case ENDPOINT_MESSAGE_RECEIVED: {
        const { participant, data } = action;

        if (data?.name !== VOICE_TRANSLATION_ENDPOINT) {
            break;
        }

        if (data.action === 'enable') {
            const alreadyEnabled = isVoiceTranslationEnabled(state);

            store.dispatch(enableVoiceTranslation({
                broadcast: false,
                startedBy: data.participantId || participant?.getId?.()
            }));

            if (!alreadyEnabled) {
                store.dispatch(setVoiceTranslationPopupVisible(true));
            }
        }

        if (data.action === 'disable') {
            store.dispatch(disableVoiceTranslation({ broadcast: false, reason: data.reason }));

            if (data.reason === 'participant-limit' && !isLocalParticipantModerator(state)) {
                store.dispatch(showWarningNotification({
                    titleKey: 'notify.voiceTranslationLimitTitle',
                    descriptionKey: 'notify.voiceTranslationLimitDescription',
                    descriptionArguments: { max: MAX_VOICE_TRANSLATION_PARTICIPANTS }
                }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
            }
        }

        if (data.action === 'preferences' && data.preferences) {
            const participantId = data.participantId || participant?.getId?.();

            if (participantId) {
                store.dispatch(setParticipantTranslationPreferences(participantId, data.preferences));
            }
        }

        if (data.action === 'translating') {
            const participantId = data.participantId || participant?.getId?.();

            if (participantId) {
                store.dispatch(setParticipantTranslating(
                    participantId,
                    Boolean(data.translating),
                    { broadcast: false }
                ));
            }
        }

        if (data.action === 'request-preferences') {
            const localPreferences = getLocalTranslationPreferences(state);

            if (!localPreferences?.fromLanguage || !localPreferences?.toLanguage) {
                store.dispatch(setVoiceTranslationPopupVisible(true));
            }
        }
        break;
    }
    }

    return result;
});
