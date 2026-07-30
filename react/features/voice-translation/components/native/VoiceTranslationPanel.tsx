/* eslint-disable react/jsx-no-bind */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    Text,
    TextInput,
    TouchableHighlight,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconArrowRight, IconCheck, IconVolumeUp } from '../../../base/icons/svg';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import {
    getLocalParticipant,
    isLocalParticipantModerator
} from '../../../base/participants/functions';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { dismissTranscriptionConsent } from '../../../chat/actions.any';
import { setRequestingSubtitles, setSubtitlesLanguage } from '../../../subtitles/actions.any';
import {
    disableVoiceTranslation,
    enableVoiceTranslation,
    setTranslationPreferences,
    setVoiceTranslationPopupVisible
} from '../../actions';
import {
    getLocalTranslationPreferences,
    isVoiceTranslationAvailable,
    isVoiceTranslationEnabled,
    shouldReplaceRemoteVoices
} from '../../functions';
import {
    FALLBACK_VOICE_TRANSLATION_LANGUAGES,
    IVoiceTranslationLanguage,
    fetchVoiceTranslationLanguages,
    toBaseVoiceLanguage
} from '../../languages';

import { useNativePiperTTS } from './NativePiperTTSProvider';
import styles from './styles';

type SelectorType = 'from' | 'to';

function findLanguageName(languages: IVoiceTranslationLanguage[], code: string) {
    return languages.find(language => language.code === code)?.name || code || '';
}

/**
 * Native voice translation preferences and consent panel.
 *
 * @returns {React.ReactElement}
 */
export default function VoiceTranslationPanel() {
    const dispatch = useDispatch();
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const {
        isConnected,
        isConnecting,
        languages: socketLanguages,
        lastError,
        setEnabled
    } = useNativePiperTTS();
    const localPreferences = useSelector(getLocalTranslationPreferences);
    const localParticipant = useSelector(getLocalParticipant);
    const requestingSubtitles = useSelector(
        (state: IReduxState) => state['features/subtitles']._requestingSubtitles);
    const voiceTranslationAvailable = useSelector(isVoiceTranslationAvailable);
    const voiceTranslationEnabled = useSelector(isVoiceTranslationEnabled);
    const isModerator = useSelector(isLocalParticipantModerator);
    const voicesReplaced = useSelector(shouldReplaceRemoteVoices);
    const [ languages, setLanguages ] = useState<IVoiceTranslationLanguage[]>(
        FALLBACK_VOICE_TRANSLATION_LANGUAGES);
    const [ expandedSelector, setExpandedSelector ] = useState<SelectorType | null>(null);
    const [ search, setSearch ] = useState('');
    const [ fromLanguage, setFromLanguage ] = useState(localPreferences.fromLanguage || 'en');
    const [ toLanguage, setToLanguage ] = useState(localPreferences.toLanguage || 'es');

    useEffect(() => {
        setEnabled(true);

        return () => setEnabled(false);
    }, [ setEnabled ]);

    useEffect(() => {
        let cancelled = false;

        fetchVoiceTranslationLanguages().then(nextLanguages => {
            if (!cancelled && nextLanguages.length) {
                setLanguages(nextLanguages);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setFromLanguage(localPreferences.fromLanguage || 'en');
        setToLanguage(localPreferences.toLanguage || 'es');
    }, [ localPreferences ]);

    const ttsLanguages = useMemo(() => {
        const fromSocket = socketLanguages.map(language => ({
            code: language.id,
            name: language.placeholder || language.id
        }));

        return fromSocket.length ? fromSocket : languages;
    }, [ languages, socketLanguages ]);

    const closePanel = useCallback(() => {
        dispatch(setVoiceTranslationPopupVisible(false));

        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    }, [ dispatch, navigation ]);

    const handleDisable = useCallback(() => {
        dispatch(setVoiceTranslationPopupVisible(false));
        dispatch(dismissTranscriptionConsent());
        dispatch(disableVoiceTranslation());
        dispatch(setRequestingSubtitles(false, false, null));
        closePanel();
    }, [ closePanel, dispatch ]);

    const handleSave = useCallback(() => {
        if (!fromLanguage || !toLanguage || (!voiceTranslationEnabled && !voiceTranslationAvailable)) {
            return;
        }

        const preferences = {
            dontTranslate: false,
            fromLanguage,
            toLanguage
        };

        if (isModerator && !voiceTranslationEnabled) {
            dispatch(enableVoiceTranslation());
        }

        dispatch(setTranslationPreferences(preferences, localParticipant?.id));

        const baseLanguage = toBaseVoiceLanguage(toLanguage || fromLanguage);

        if (baseLanguage) {
            const subtitlesLanguage = `translation-languages:${baseLanguage}`;

            dispatch(setSubtitlesLanguage(subtitlesLanguage));

            if (isModerator && !requestingSubtitles) {
                dispatch(setRequestingSubtitles(true, true, subtitlesLanguage));
            }
        } else if (isModerator && !requestingSubtitles) {
            dispatch(setRequestingSubtitles(true, false, null));
        }

        closePanel();
    }, [
        closePanel,
        dispatch,
        fromLanguage,
        isModerator,
        localParticipant?.id,
        requestingSubtitles,
        toLanguage,
        voiceTranslationAvailable,
        voiceTranslationEnabled
    ]);

    const renderLanguageOptions = useCallback((
            selector: SelectorType,
            languageItems: IVoiceTranslationLanguage[],
            value: string,
            onSelect: (language: string) => void) => {
        if (expandedSelector !== selector) {
            return null;
        }

        const loweredSearch = search.trim().toLowerCase();
        const filteredLanguages = languageItems.filter(language =>
            !loweredSearch
            || language.name.toLowerCase().includes(loweredSearch)
            || language.code.toLowerCase().includes(loweredSearch));

        return (
            <View style = { styles.dropdown as ViewStyle }>
                <TextInput
                    autoCorrect = { false }
                    onChangeText = { setSearch }
                    placeholder = { t('voiceTranslation.searchLanguages') }
                    placeholderTextColor = { BaseTheme.palette.text03 }
                    style = { styles.searchInput }
                    value = { search } />
                <ScrollView
                    keyboardShouldPersistTaps = 'handled'
                    nestedScrollEnabled = { true }>
                    {filteredLanguages.map(language => {
                        const selected = language.code === value;

                        return (
                            <TouchableHighlight
                                key = { language.code }
                                onPress = { () => {
                                    onSelect(language.code);
                                    setExpandedSelector(null);
                                    setSearch('');
                                } }
                                style = { [
                                    styles.languageOption,
                                    selected && styles.languageOptionSelected
                                ] }
                                underlayColor = { BaseTheme.palette.ui04 }>
                                <View style = { styles.optionContent as ViewStyle }>
                                    <Text style = { styles.languageOptionText }>
                                        { language.name }
                                    </Text>
                                    {selected && (
                                        <Icon
                                            size = { 20 }
                                            src = { IconCheck }
                                            style = { styles.checkIcon } />
                                    )}
                                </View>
                            </TouchableHighlight>
                        );
                    })}
                </ScrollView>
            </View>
        );
    }, [ expandedSelector, search, t ]);

    const renderLanguageField = useCallback((
            selector: SelectorType,
            label: string,
            value: string,
            languageItems: IVoiceTranslationLanguage[],
            onSelect: (language: string) => void) => {
        return (
            <View style = { styles.languageField as ViewStyle }>
                <TouchableHighlight
                    onPress = { () => {
                        setSearch('');
                        setExpandedSelector(expandedSelector === selector ? null : selector);
                    } }
                    underlayColor = { BaseTheme.palette.ui04 }>
                    <View style = { styles.languageTrigger as ViewStyle }>
                        <Text style = { styles.languageLabel }>{ label }</Text>
                        <Text
                            numberOfLines = { 1 }
                            style = { styles.languageValue }>
                            { findLanguageName(languageItems, value) || t('voiceTranslation.selectLanguage') }
                        </Text>
                        <Icon
                            size = { 20 }
                            src = { IconArrowRight } />
                    </View>
                </TouchableHighlight>
                { renderLanguageOptions(selector, languageItems, value, onSelect) }
            </View>
        );
    }, [ expandedSelector, renderLanguageOptions, t ]);

    return (
        <JitsiScreen
            contentContainerStyle = { styles.screenContent }
            disableForcedKeyboardDismiss = { true }
            hasExtraHeaderHeight = { true }
            style = { styles.container }>
            <ScrollView
                keyboardShouldPersistTaps = 'handled'
                style = { styles.content as ViewStyle }>
                <View style = { styles.headerCard as ViewStyle }>
                    <Icon
                        color = { BaseTheme.palette.action01 }
                        size = { 28 }
                        src = { IconVolumeUp } />
                    <Text style = { styles.title }>{ t('voiceTranslation.popupTitle') }</Text>
                    <Text style = { styles.description }>
                        { t('voiceTranslation.step1Description') }
                    </Text>
                    {voiceTranslationEnabled && (
                        <View style = { styles.statusRow as ViewStyle }>
                            <View style = { styles.statusDot as ViewStyle } />
                            <Text style = { styles.statusText }>
                                { t('voiceTranslation.active') }
                            </Text>
                        </View>
                    )}
                    {voicesReplaced && (
                        <Text style = { styles.description }>
                            { t('voiceTranslation.voicesMuted') }
                        </Text>
                    )}
                </View>

                <View style = { styles.section as ViewStyle }>
                    <Text style = { styles.sectionTitle }>
                        { t('voiceTranslation.preferencesTitle') }
                    </Text>
                    {renderLanguageField(
                        'from',
                        t('voiceTranslation.speakingLanguageLabel'),
                        fromLanguage,
                        languages,
                        setFromLanguage
                    )}
                    {renderLanguageField(
                        'to',
                        t('voiceTranslation.translationLanguageLabel'),
                        toLanguage,
                        ttsLanguages,
                        setToLanguage
                    )}
                </View>

                <View style = { styles.notice as ViewStyle }>
                    <Text style = { styles.noticeText }>
                        { t('voiceTranslation.translationVariationNotice') }
                    </Text>
                    <Text style = { [ styles.noticeText, styles.noticeTextSpacing ] }>
                        { t('voiceTranslation.privacyNotice') }
                    </Text>
                </View>

                {Boolean(lastError) && (
                    <Text style = { styles.errorText }>
                        { lastError }
                    </Text>
                )}
                {(isConnecting || isConnected) && (
                    <Text style = { styles.description }>
                        { isConnected
                            ? t('voiceTranslation.socketConnected')
                            : t('voiceTranslation.socketConnecting') }
                    </Text>
                )}

                <View style = { styles.footer as ViewStyle }>
                    {voiceTranslationEnabled && isModerator && (
                        <Button
                            accessibilityLabel = 'voiceTranslation.disableVoiceTranslation'
                            labelKey = 'voiceTranslation.disableVoiceTranslation'
                            onClick = { handleDisable }
                            style = { styles.footerButton }
                            type = { BUTTON_TYPES.DESTRUCTIVE } />
                    )}
                    <Button
                        accessibilityLabel = 'voiceTranslation.skipForNow'
                        labelKey = 'voiceTranslation.skipForNow'
                        onClick = { closePanel }
                        style = { styles.footerButton }
                        type = { BUTTON_TYPES.SECONDARY } />
                    <Button
                        accessibilityLabel = 'voiceTranslation.savePreferences'
                        disabled = { !fromLanguage || !toLanguage
                            || (!voiceTranslationEnabled && !voiceTranslationAvailable) }
                        labelKey = { voiceTranslationEnabled
                            ? 'voiceTranslation.update'
                            : 'voiceTranslation.translate' }
                        onClick = { handleSave }
                        style = { styles.footerButton }
                        type = { BUTTON_TYPES.PRIMARY } />
                </View>
            </ScrollView>
        </JitsiScreen>
    );
}
