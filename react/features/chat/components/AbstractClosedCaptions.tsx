import React, { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import { getCurrentConference } from '../../base/conference/functions';
import { openDialog } from '../../base/dialog/actions';
import { getLocalParticipant, isLocalParticipantModerator } from '../../base/participants/functions';
import { IMessageGroup, groupMessagesBySender } from '../../base/util/messageGrouping';
// @ts-ignore
import { StartRecordingDialog } from '../../recording/components/Recording';
import { setRequestingSubtitles } from '../../subtitles/actions.any';
import { canStartSubtitles } from '../../subtitles/functions.any';
import { normalizeSubtitlesLanguage } from '../../subtitles/languages';
import { ISubtitle } from '../../subtitles/types';
import { isTranscribing } from '../../transcribing/functions';
import { notifyTranscriptionStarted, setTranscriptionStartedByCurrentUser } from '../actions.any';

type FlowStatus = 'idle' | 'starting' | 'stopping';

export type AbstractProps = {
    canStartSubtitles: boolean;
    canStopSubtitles: boolean;
    filteredSubtitles: ISubtitle[];
    groupedSubtitles: IMessageGroup<ISubtitle>[];
    isAsyncTranscriptionEnabled: boolean;
    isButtonPressed: boolean;
    isTranscribing: boolean;
    selectedLanguage: string | null;
    startClosedCaptions: () => void;
    stopClosedCaptions: () => void;
};

const AbstractClosedCaptions = (Component: ComponentType<AbstractProps>) => () => {
    const dispatch = useDispatch();
    const subtitles = useSelector((state: IReduxState) => state['features/subtitles'].subtitlesHistory);
    const language = useSelector((state: IReduxState) => state['features/subtitles']._language);
    const _isTranscribing = useSelector(isTranscribing);
    const transcriberJID = useSelector((state: IReduxState) => state['features/transcribing'].transcriberJID);
    const effectiveIsTranscribing = Boolean(_isTranscribing || transcriberJID);
    const selectedLanguage = normalizeSubtitlesLanguage(language) || (effectiveIsTranscribing ? 'en' : null);
    const _canStartSubtitles = useSelector(canStartSubtitles);
    const _isLocalModerator = useSelector(isLocalParticipantModerator);
    const subtitlesError = useSelector((state: IReduxState) => state['features/subtitles']._hasError);
    const isAsyncTranscriptionEnabled = useSelector((state: IReduxState) =>
        Boolean(state['features/base/conference'].conference?.getMetadataHandler()?.getMetadata()?.asyncTranscription));
    const conference = useSelector((state: IReduxState) => getCurrentConference(state));
    const localParticipant = useSelector((state: IReduxState) => getLocalParticipant(state));
    const transcriptionStartedByCurrentUser = useSelector((state: IReduxState) =>
        Boolean(state['features/chat'].transcriptionStartedByCurrentUser));
    const [ isButtonPressed, setButtonPressed ] = useState(false);
    const [ status, setStatus ] = useState<FlowStatus>('idle');
    const inFlightTimer = useRef<ReturnType<typeof setTimeout>>();
    const canStartLiveCaptions = _canStartSubtitles || _isLocalModerator;
    const canStopLiveCaptions = effectiveIsTranscribing && transcriptionStartedByCurrentUser;

    const clearInFlightTimeout = useCallback(() => {
        if (inFlightTimer.current) {
            clearTimeout(inFlightTimer.current);
            inFlightTimer.current = undefined;
        }
    }, []);

    const armInFlightTimeout = useCallback(() => {
        clearInFlightTimeout();
        inFlightTimer.current = setTimeout(() => setStatus('idle'), 10000);
    }, [ clearInFlightTimeout ]);

    const filteredSubtitles = useMemo(() => {
        const transcriptionMessages = new Map(
            subtitles
                .filter(s => s.isTranscription)
                .map(s => [ s.id, s ])
        );
        let baseMessages: ISubtitle[];

        if (!selectedLanguage) {
            baseMessages = Array.from(transcriptionMessages.values());
        } else {
            const translationMessages = new Map(
                subtitles
                    .filter(s => !s.isTranscription && normalizeSubtitlesLanguage(s.language) === selectedLanguage)
                    .map(s => [ s.id, s ])
            );

            baseMessages = Array.from(transcriptionMessages.values())
                .map(m => translationMessages.get(m.id) ?? m);
        }

        const interimByParticipant = new Map<string, ISubtitle>();

        for (const message of baseMessages) {
            if (!message.interim || !message.participantId) {
                continue;
            }

            const existing = interimByParticipant.get(message.participantId);

            if (!existing || Number(message.timestamp) >= Number(existing.timestamp)) {
                interimByParticipant.set(message.participantId, message);
            }
        }

        const activeInterimIds = new Set(Array.from(interimByParticipant.values()).map(m => m.id));
        const finalizedMessages = baseMessages.filter(message =>
            !message.interim && !activeInterimIds.has(message.id)
        );

        return [ ...finalizedMessages, ...Array.from(interimByParticipant.values()) ];
    }, [ subtitles, selectedLanguage ]);

    const groupedSubtitles = useMemo(() =>
        groupMessagesBySender(filteredSubtitles), [ filteredSubtitles ]);

    const startClosedCaptions = useCallback(() => {
        if (status !== 'idle' || effectiveIsTranscribing) {
            return;
        }

        if (isAsyncTranscriptionEnabled) {
            dispatch(openDialog('StartRecordingDialog', StartRecordingDialog, {
                recordAudioAndVideo: false
            }));

            return;
        }

        if (isButtonPressed) {
            return;
        }

        setStatus('starting');
        setButtonPressed(true);
        armInFlightTimeout();
        dispatch(setTranscriptionStartedByCurrentUser(true));
        dispatch(setRequestingSubtitles(true, false, null));
        conference?.sendCommand?.('transcription-active', { value: 'true' });
        dispatch(notifyTranscriptionStarted(
            localParticipant?.displayName || localParticipant?.name || 'Moderator'
        ));
    }, [
        armInFlightTimeout,
        conference,
        dispatch,
        effectiveIsTranscribing,
        isAsyncTranscriptionEnabled,
        isButtonPressed,
        localParticipant?.displayName,
        localParticipant?.name,
        status
    ]);

    const stopClosedCaptions = useCallback(() => {
        if (status !== 'idle' || !effectiveIsTranscribing) {
            return;
        }

        setStatus('stopping');
        setButtonPressed(false);
        armInFlightTimeout();
        dispatch(setTranscriptionStartedByCurrentUser(false));
        dispatch(setRequestingSubtitles(false, false, null));
        conference?.sendCommand?.('transcription-active', { value: 'false' });
    }, [ armInFlightTimeout, conference, dispatch, effectiveIsTranscribing, status ]);

    useEffect(() => {
        if (subtitlesError && isButtonPressed && !isAsyncTranscriptionEnabled) {
            clearInFlightTimeout();
            setButtonPressed(false);
            setStatus('idle');
        }
    }, [ clearInFlightTimeout, subtitlesError, isButtonPressed, isAsyncTranscriptionEnabled ]);

    useEffect(() => {
        if (status === 'starting' && effectiveIsTranscribing) {
            clearInFlightTimeout();
            setStatus('idle');
            setButtonPressed(false);
        }

        if (status === 'stopping' && !effectiveIsTranscribing) {
            clearInFlightTimeout();
            setStatus('idle');
        }
    }, [ clearInFlightTimeout, effectiveIsTranscribing, status ]);

    useEffect(() => () => clearInFlightTimeout(), [ clearInFlightTimeout ]);

    return (
        <Component
            canStartSubtitles = { canStartLiveCaptions }
            canStopSubtitles = { canStopLiveCaptions }
            filteredSubtitles = { filteredSubtitles }
            groupedSubtitles = { groupedSubtitles }
            isAsyncTranscriptionEnabled = { isAsyncTranscriptionEnabled }
            isButtonPressed = { isButtonPressed }
            isTranscribing = { effectiveIsTranscribing }
            selectedLanguage = { selectedLanguage }
            startClosedCaptions = { startClosedCaptions }
            stopClosedCaptions = { stopClosedCaptions } />
    );
};

export default AbstractClosedCaptions;
