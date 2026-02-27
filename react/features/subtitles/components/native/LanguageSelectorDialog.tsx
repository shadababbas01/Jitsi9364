import React, {
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { DEFAULT_LANGUAGE, TRANSLATION_LANGUAGES, TRANSLATION_LANGUAGES_HEAD } from '../../../base/i18n/i18next';
import Text from '../../../base/react/components/native/Text';
import { IReduxState } from '../../../app/types';
import { getLocalParticipant } from '../../../base/participants/functions';
import { notifyTranscriptionStarted, setTranscriptionStartedByCurrentUser } from '../../../chat/actions.any';
import { setRequestingSubtitles } from '../../actions.any';

import LanguageList from './LanguageList';
import styles from './styles';

const defaultLanguageKey = `translation-languages:${DEFAULT_LANGUAGE}`;

const LanguageSelectorDialog = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const transcriptionConfig = useSelector((state: IReduxState) => state['features/base/config'].transcription);
    const {
        _displaySubtitles,
        _history = [],
        _language,
        _requestingSubtitles
    } = useSelector((state: IReduxState) => state['features/subtitles']);
    const transcriptionStartedByCurrentUser = useSelector(
        (state: IReduxState) => state['features/chat'].transcriptionStartedByCurrentUser
    );
    const localParticipant = useSelector(getLocalParticipant);
    const [ selectedLanguage, setSelectedLanguage ] = useState<string>(defaultLanguageKey);

    useEffect(() => {
        setSelectedLanguage(_language ?? defaultLanguageKey);
    }, [ _language ]);

    const isCaptionsActive = Boolean(_requestingSubtitles && _displaySubtitles);
    const activeLanguage = selectedLanguage ?? defaultLanguageKey;

    const languageList = useMemo(() => {
        const translationLanguages = transcriptionConfig?.translationLanguages ?? TRANSLATION_LANGUAGES;
        const translationLanguagesHead = transcriptionConfig?.translationLanguagesHead ?? TRANSLATION_LANGUAGES_HEAD;

        const headLanguages = translationLanguagesHead
            ? translationLanguagesHead.map(lang => `translation-languages:${lang}`)
            : [];

        const otherLanguages = translationLanguages
            .map(lang => `translation-languages:${lang}`)
            .filter(lang => !headLanguages.includes(lang) && lang !== activeLanguage);

        const orderedLanguages = headLanguages.includes(activeLanguage)
            ? [ ...headLanguages, ...otherLanguages ]
            : [ ...headLanguages, activeLanguage, ...otherLanguages ];

        return orderedLanguages.map((lang, index) => ({
            id: `${lang}-${index}`,
            lang,
            selected: lang === activeLanguage
        }));
    }, [ activeLanguage, transcriptionConfig ]);

    const historyEntries = useMemo(() => {
        if (!_history?.length) {
            return [];
        }
        return [ ..._history ].reverse();
    }, [ _history ]);

    const handleSelectLanguage = useCallback((lang: string) => {
        setSelectedLanguage(lang);
    }, []);

    const startLiveCaptions = useCallback(() => {
        if (isCaptionsActive) {
            return;
        }

        const languageKey = selectedLanguage ?? defaultLanguageKey;
        dispatch(setRequestingSubtitles(true, true, languageKey));
        dispatch(setTranscriptionStartedByCurrentUser(true));

        if (!transcriptionStartedByCurrentUser) {
            const moderatorName = localParticipant?.name
                || localParticipant?.displayName
                || t('transcriptionConsent.defaultModeratorName');

            dispatch(notifyTranscriptionStarted(moderatorName));
        }
    }, [
        dispatch,
        isCaptionsActive,
        localParticipant,
        selectedLanguage,
        transcriptionStartedByCurrentUser,
        t
    ]);

    const stopLiveCaptions = useCallback(() => {
        if (!isCaptionsActive) {
            return;
        }

        dispatch(setRequestingSubtitles(false, false, null));
        dispatch(setTranscriptionStartedByCurrentUser(false));
    }, [ dispatch, isCaptionsActive ]);

    return (
        <JitsiScreen
            disableForcedKeyboardDismiss = { true }
            style = { styles.subtitlesContainer }>
             <ScrollView contentContainerStyle = { styles.scrollContent }>
                <View style = { styles.header }>
                    <Text style = { styles.headerTitle }>
                        { t('transcribing.subtitles') }
                    </Text>
                    <Text style = { styles.headerSubtitle }>
                        { t('transcribing.languageLabel') }: { t(activeLanguage) }
                    </Text>
                </View>
                <View style = { styles.buttonRow }>
                    <Button
                        disabled = { isCaptionsActive }
                        labelKey = 'closedCaptionsTab.startClosedCaptionsButton'
                        onClick = { startLiveCaptions }
                        style = { styles.button } />
                    <Button
                        disabled = { !isCaptionsActive }
                        labelKey = 'closedCaptionsTab.closeLiveCaptionButton'
                        onClick = { stopLiveCaptions }
                        style = { styles.button }
                        type = { BUTTON_TYPES.SECONDARY } />
                </View>
                <View style = { styles.languageListSection }>
                    <LanguageList
                        items = { languageList }
                        onLanguageSelected = { handleSelectLanguage }
                        selectedLanguage = { activeLanguage } />
                </View>
                <View style = { styles.historySection }>
                    <Text style = { styles.historyTitle }>
                        { t('closedCaptionsTab.historyTitle') }
                    </Text>
                    {
                        !historyEntries.length
                            ? (
                                <Text style = { styles.historyEmpty }>
                                    { t('closedCaptionsTab.emptyState') }
                                </Text>
                            )
                            : historyEntries.map(entry => (
                                <Text
                                    key = { entry.id }
                                    style = { styles.historyItem }>
                                    { entry.text }
                                </Text>
                            ))
                    }
                </View>
            </ScrollView>
        </JitsiScreen>
    );
};

/*
 * We apply AbstractLanguageSelector to fill in the AbstractProps common
 * to both the web and native implementations.
 */
// eslint-disable-next-line new-cap
export default LanguageSelectorDialog;