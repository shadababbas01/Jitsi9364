import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { IReduxState } from '../../../app/types';
import Select from '../../../base/ui/components/web/Select';
import { setSubtitlesLanguage } from '../../actions.any';
import { getAvailableSubtitlesLanguages } from '../../functions.any';
import {
    ILiveCaptionsLanguage,
    fetchLiveCaptionsLanguages,
    normalizeSubtitlesLanguage,
    toSubtitlesLanguageValue
} from '../../languages';

/**
 * The styles for the LanguageSelector component.
 *
 * @param {Theme} theme - The MUI theme.
 * @returns {Object} The styles object.
 */
const useStyles = makeStyles()(theme => {
    return {
        container: {
            display: 'flex',
            alignItems: 'center',
            padding: theme.spacing(2),
            gap: theme.spacing(2)
        },
        select: {
            flex: 1,
            minWidth: 200
        },
        label: {
            ...theme.typography.bodyShortRegular,
            color: theme.palette.text01,
            whiteSpace: 'nowrap'
        }
    };
});

/**
 * Component that renders a language selection dropdown.
 * Uses the same language options as LanguageSelectorDialog and
 * updates the subtitles language preference in Redux.
 *
 * @returns {JSX.Element} - The rendered component.
 */
function LanguageSelector() {
    const { t } = useTranslation();
    const { classes } = useStyles();
    const dispatch = useDispatch();
    const selectedLanguage = useSelector((state: IReduxState) => state['features/subtitles']._language);
    const selectedCode = normalizeSubtitlesLanguage(selectedLanguage);
    const languageCodes = useSelector((state: IReduxState) => getAvailableSubtitlesLanguages(
        state,
        selectedCode
    ));
    const [ apiLanguages, setApiLanguages ] = useState<ILiveCaptionsLanguage[]>([]);
    const languageCodesKey = languageCodes.join('|');
    const isAsyncTranscriptionEnabled = useSelector((state: IReduxState) =>
        state['features/base/conference'].conference?.getMetadataHandler()?.getMetadata()?.asyncTranscription);

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

    /**
     * Maps available languages to Select component options format.
     *
     * @type {Array<{value: string, label: string}>}
     */
    const languages = useMemo(() => {
        const source = apiLanguages.length
            ? apiLanguages
            : languageCodes.map(code => ({
                code,
                label: t(toSubtitlesLanguageValue(code)),
                value: toSubtitlesLanguageValue(code)
            }));

        return source.map(lang => ({
            value: lang.value,
            label: lang.label
        }));
    }, [ apiLanguages, languageCodes, t ]);

    /**
     * Handles language selection changes.
     * Dispatches the setSubtitlesLanguage action with the new language.
     *
     * @param {string} value - The selected language code.
     * @returns {void}
     */
    const onLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;

        dispatch(setSubtitlesLanguage(value));
    }, [ dispatch ]);

    // Hide the "Translate to" option when asyncTranscription is enabled
    if (isAsyncTranscriptionEnabled) {
        return null;
    }

    return (
        <div className = { classes.container }>
            <span className = { classes.label }>
                {t('transcribing.translateTo')}:
            </span>
            <Select
                className = { classes.select }
                id = 'subtitles-language-select'
                onChange = { onLanguageChange }
                options = { languages }
                value = { selectedLanguage || toSubtitlesLanguageValue('en') } />
        </div>
    );
}

export default LanguageSelector;
