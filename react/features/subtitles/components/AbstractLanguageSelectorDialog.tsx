import React, { ComponentType, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState, IStore } from '../../app/types';
import { openDialog } from '../../base/dialog/actions';
import { StartRecordingDialog } from '../../recording/components/Recording/index';
import { isTranscribing } from '../../transcribing/functions';
import { setRequestingSubtitles, setSubtitlesLanguage } from '../actions.any';
import { getAvailableSubtitlesLanguages } from '../functions.any';
import {
    ILiveCaptionsLanguage,
    fetchLiveCaptionsLanguages,
    normalizeSubtitlesLanguage,
    toSubtitlesLanguageValue
} from '../languages';

export interface IAbstractLanguageSelectorDialogProps {
    dispatch: IStore['dispatch'];
    language: string | null;
    listItems: Array<any>;
    onLanguageSelected: (e: string) => void;
    subtitles: string;
    t: Function;
}


/**
 * Higher Order Component taking in a concrete LanguageSelector component and
 * augmenting it with state/behavior common to both web and native implementations.
 *
 * @param {React.Component} Component - The concrete component.
 * @returns {React.Component}
 */
const AbstractLanguageSelectorDialog = (Component: ComponentType<IAbstractLanguageSelectorDialogProps>) => () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const language = useSelector((state: IReduxState) => state['features/subtitles']._language);
    const _isTranscribing = useSelector(isTranscribing);
    const transcriberJID = useSelector((state: IReduxState) => state['features/transcribing'].transcriberJID);
    const effectiveIsTranscribing = Boolean(_isTranscribing || transcriberJID);

    // The value for the selected language contains "translation-languages:" prefix.
    const selectedLanguage = normalizeSubtitlesLanguage(language) || (effectiveIsTranscribing ? 'en' : null);
    const languageCodes = useSelector((state: IReduxState) => getAvailableSubtitlesLanguages(state, selectedLanguage));
    const [ apiLanguages, setApiLanguages ] = useState<ILiveCaptionsLanguage[]>([]);
    const languageCodesKey = languageCodes.join('|');

    useEffect(() => {
        let cancelled = false;

        fetchLiveCaptionsLanguages(languageCodes).then(languages => {
            if (!cancelled) {
                setApiLanguages(languages);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [ languageCodesKey ]);

    const noLanguageLabel = 'transcribing.subtitlesOff';
    const selected = selectedLanguage ? toSubtitlesLanguageValue(selectedLanguage) : noLanguageLabel;
    const languageItems = useMemo(() => {
        const fromApi = apiLanguages.length
            ? apiLanguages
            : languageCodes.map((code: string) => ({
                code,
                label: t(toSubtitlesLanguageValue(code)),
                value: toSubtitlesLanguageValue(code)
            }));

        return [
            ...(!effectiveIsTranscribing ? [ {
                code: '',
                label: t(noLanguageLabel),
                value: noLanguageLabel
            } ] : []),
            ...fromApi
        ];
    }, [ apiLanguages, effectiveIsTranscribing, languageCodes, t ]);
    const listItems = languageItems
        .map((lang, index) => {
            return {
                id: lang.value + index,
                label: lang.label,
                lang: lang.value,
                selected: lang.value === selected
            };
        });
    const { conference } = useSelector((state: IReduxState) => state['features/base/conference']);

    const onLanguageSelected = useCallback((value: string) => {
        const _selectedLanguage = value === noLanguageLabel ? null : value;
        const enabled = effectiveIsTranscribing || Boolean(_selectedLanguage);
        const displaySubtitles = Boolean(_selectedLanguage);

        if (conference?.getMetadataHandler()?.getMetadata()?.asyncTranscription && !effectiveIsTranscribing) {
            dispatch(openDialog('StartRecordingDialog', StartRecordingDialog, {
                recordAudioAndVideo: false
            }));
        } else if (effectiveIsTranscribing) {
            dispatch(setSubtitlesLanguage(_selectedLanguage));
        } else {
            dispatch(setRequestingSubtitles(enabled, displaySubtitles, _selectedLanguage));
        }
    }, [ conference, dispatch, effectiveIsTranscribing ]);

    return (
        <Component
            dispatch = { dispatch }
            language = { language }
            listItems = { listItems }
            onLanguageSelected = { onLanguageSelected }
            subtitles = { selected }
            t = { t } />
    );
};

export default AbstractLanguageSelectorDialog;
