/* eslint-disable react/jsx-no-bind */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    Text,
    TextInput,
    TouchableHighlight,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import {
    IconArrowDown,
    IconCheck,
    IconCloseLarge,
    IconMic,
    IconMicSlash,
    IconVolumeOff,
    IconVolumeUp
} from '../../../base/icons/svg';
import { getLocalParticipant } from '../../../base/participants/functions';
import { setCaptionTtsEnabled } from '../../../caption-tts/actions';
import { isCaptionTtsEnabled, isCaptionTtsSupported } from '../../../caption-tts/functions.native';
import { setLiveTranscribeEnabled } from '../../../live-transcribe/actions';
import {
    getLiveTranscribeState,
    isLiveTranscribeEnabled,
    isLiveTranscribeSupported
} from '../../../live-transcribe/functions.native';
import { setSubtitlesLanguage, setSubtitlesPanelOpen } from '../../../subtitles/actions.any';
import { CAPTIONS_PANEL_TOOLBAR_RESERVE } from '../../../subtitles/constants';
import { getCaptionsPanelHeight, isLiveCaptionsActive } from '../../../subtitles/functions.any';
import {
    normalizeSubtitlesLanguage,
    toBaseSubtitlesLanguage,
    toSubtitlesLanguageValue
} from '../../../subtitles/languages';
import { ISubtitle } from '../../../subtitles/types';
import { setTranslationPreferences } from '../../../voice-translation/actions';
import { getLocalTranslationPreferences } from '../../../voice-translation/functions';
import {
    FALLBACK_VOICE_TRANSLATION_LANGUAGES,
    IVoiceTranslationLanguage,
    fetchVoiceTranslationLanguages
} from '../../../voice-translation/languages';

import CaptionTranslationPair from './CaptionTranslationPair';
import { captionsPanelStyles } from './styles';

type SelectorType = 'from' | 'to';

/**
 * The default language pair, used until the local user picks their own.
 */
const DEFAULT_FROM_LANGUAGE = 'en';
const DEFAULT_TO_LANGUAGE = 'en';

/**
 * Builds the caption pairs to render: the transcribed captions, newest last, each with the translation the transcriber
 * already sent for it when there is one.
 *
 * Interim captions are collapsed to the newest one per speaker, the same way the full screen tab does it, so a caption
 * being dictated does not push the finished ones around.
 *
 * @param {ISubtitle[]} history - The caption history.
 * @param {string} targetLanguage - The language the local user wants to read.
 * @returns {Array} - The captions to render, each with its translation when one is already known.
 */
function buildCaptionPairs(history: ISubtitle[], targetLanguage: string | null) {
    const transcriptions: ISubtitle[] = [];
    const translations = new Map<string, string>();

    for (const subtitle of history) {
        if (subtitle.isTranscription) {
            transcriptions.push(subtitle);
        } else if (targetLanguage
                && toBaseSubtitlesLanguage(subtitle.language) === toBaseSubtitlesLanguage(targetLanguage)
                && subtitle.text?.trim()) {
            translations.set(subtitle.id, subtitle.text);
        }
    }

    const latestInterimBySpeaker = new Map<string, ISubtitle>();

    for (const subtitle of transcriptions) {
        if (!subtitle.interim || !subtitle.participantId) {
            continue;
        }

        const existing = latestInterimBySpeaker.get(subtitle.participantId);

        if (!existing || Number(subtitle.timestamp) >= Number(existing.timestamp)) {
            latestInterimBySpeaker.set(subtitle.participantId, subtitle);
        }
    }

    const liveInterimIds = new Set(Array.from(latestInterimBySpeaker.values()).map(subtitle => subtitle.id));

    return [
        ...transcriptions.filter(subtitle => !subtitle.interim && !liveInterimIds.has(subtitle.id)),
        ...Array.from(latestInterimBySpeaker.values())
    ]
        .filter(subtitle => subtitle.text?.trim())
        .map(subtitle => ({
            subtitle,
            translation: translations.get(subtitle.id)
        }));
}

/**
 * The live captions shown underneath the video: the language pair being translated, and the running transcript with each
 * caption next to what it means.
 *
 * @returns {JSX.Element | null}
 */
export default function CaptionsPanel() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const height = useSelector(getCaptionsPanelHeight);
    const safeAreaBottom = useSelector((state: IReduxState) =>
        state['features/base/responsive-ui'].safeAreaInsets?.bottom ?? 0);
    const captionsActive = useSelector(isLiveCaptionsActive);
    const history = useSelector((state: IReduxState) => state['features/subtitles'].subtitlesHistory);
    const subtitlesLanguage = useSelector((state: IReduxState) => state['features/subtitles']._language);
    const preferences = useSelector(getLocalTranslationPreferences);
    const localParticipant = useSelector(getLocalParticipant);
    const readAloud = useSelector(isCaptionTtsEnabled);
    const transcribeOwnSpeech = useSelector(isLiveTranscribeEnabled);
    const transcribeError = useSelector((state: IReduxState) => getLiveTranscribeState(state).error);

    const [ languages, setLanguages ] = useState<IVoiceTranslationLanguage[]>(FALLBACK_VOICE_TRANSLATION_LANGUAGES);
    const [ expandedSelector, setExpandedSelector ] = useState<SelectorType | null>(null);
    const [ search, setSearch ] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    const fromLanguage = preferences.fromLanguage || DEFAULT_FROM_LANGUAGE;
    const toLanguage = normalizeSubtitlesLanguage(subtitlesLanguage) || DEFAULT_TO_LANGUAGE;

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

    const pairs = useMemo(() => buildCaptionPairs(history, toLanguage), [ history, toLanguage ]);

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [ pairs.length ]);

    const onClose = useCallback(() => {
        dispatch(setSubtitlesPanelOpen(false));
    }, [ dispatch ]);

    const onToggleReadAloud = useCallback(() => {
        dispatch(setCaptionTtsEnabled(!readAloud));
    }, [ dispatch, readAloud ]);

    const onToggleTranscribeOwnSpeech = useCallback(() => {
        dispatch(setLiveTranscribeEnabled(!transcribeOwnSpeech));
    }, [ dispatch, transcribeOwnSpeech ]);

    const applyFromLanguage = useCallback((code: string) => {
        dispatch(setTranslationPreferences({
            dontTranslate: false,
            fromLanguage: code,
            toLanguage: preferences.toLanguage || toLanguage
        }, localParticipant?.id));
    }, [ dispatch, localParticipant?.id, preferences.toLanguage, toLanguage ]);

    const applyToLanguage = useCallback((code: string) => {
        dispatch(setSubtitlesLanguage(toSubtitlesLanguageValue(code)));
        dispatch(setTranslationPreferences({
            dontTranslate: false,
            fromLanguage,
            toLanguage: code
        }, localParticipant?.id));
    }, [ dispatch, fromLanguage, localParticipant?.id ]);

    const onSwapLanguages = useCallback(() => {
        const nextFrom = toLanguage;
        const nextTo = fromLanguage;

        dispatch(setSubtitlesLanguage(toSubtitlesLanguageValue(nextTo)));
        dispatch(setTranslationPreferences({
            dontTranslate: false,
            fromLanguage: nextFrom,
            toLanguage: nextTo
        }, localParticipant?.id));
    }, [ dispatch, fromLanguage, localParticipant?.id, toLanguage ]);

    const onSelectLanguage = useCallback((code: string) => {
        if (expandedSelector === 'from') {
            applyFromLanguage(code);
        } else if (expandedSelector === 'to') {
            applyToLanguage(code);
        }

        setExpandedSelector(null);
        setSearch('');
    }, [ applyFromLanguage, applyToLanguage, expandedSelector ]);

    const languageName = useCallback((code: string) =>
        languages.find(language => language.code === code)?.name ?? code.toUpperCase(), [ languages ]);

    const renderSelector = (selector: SelectorType, code: string) => (
        <TouchableHighlight
            onPress = { () => {
                setSearch('');
                setExpandedSelector(expandedSelector === selector ? null : selector);
            } }
            style = { captionsPanelStyles.selector as ViewStyle }
            underlayColor = 'rgba(0, 0, 0, 0.04)'>
            <View style = { captionsPanelStyles.selectorContent as ViewStyle }>
                <View style = { captionsPanelStyles.selectorTextContainer as ViewStyle }>
                    <Text
                        numberOfLines = { 1 }
                        style = { captionsPanelStyles.selectorName }>
                        { languageName(code) }
                    </Text>
                    <Text style = { captionsPanelStyles.selectorCode }>
                        { code.toUpperCase() }
                    </Text>
                </View>
                <Icon
                    color = { captionsPanelStyles.selectorCode.color }
                    size = { 16 }
                    src = { IconArrowDown } />
            </View>
        </TouchableHighlight>
    );

    if (!height) {
        return null;
    }

    const loweredSearch = search.trim().toLowerCase();
    const filteredLanguages = languages.filter(language => !loweredSearch
        || language.name.toLowerCase().includes(loweredSearch)
        || language.code.toLowerCase().includes(loweredSearch));
    const selectedCode = expandedSelector === 'from' ? fromLanguage : toLanguage;

    return (
        <View style = { [ captionsPanelStyles.panel, { height } ] as ViewStyle[] }>
            <View style = { captionsPanelStyles.selectorRow as ViewStyle }>
                { renderSelector('from', fromLanguage) }
                <TouchableOpacity
                    accessibilityLabel = { t('captionsPanel.swapLanguages') }
                    hitSlop = {{ bottom: 12,
                        left: 12,
                        right: 12,
                        top: 12 }}
                    onPress = { onSwapLanguages }
                    style = { captionsPanelStyles.swapButton as ViewStyle }>
                    <Text style = { captionsPanelStyles.swapIcon }>⇄</Text>
                </TouchableOpacity>
                { renderSelector('to', toLanguage) }
            </View>

            <View style = { captionsPanelStyles.statusRow as ViewStyle }>
                { captionsActive && <View style = { captionsPanelStyles.statusDot as ViewStyle } /> }
                <Text style = { captionsPanelStyles.statusText }>
                    { captionsActive ? t('captionsPanel.liveTranslation') : t('captionsPanel.paused') }
                </Text>
                {
                    isLiveTranscribeSupported() && (
                        <TouchableOpacity
                            accessibilityLabel = { t('liveTranscribe.transcribeOwnSpeech') }
                            hitSlop = {{ bottom: 8,
                                left: 8,
                                right: 8,
                                top: 8 }}
                            onPress = { onToggleTranscribeOwnSpeech }
                            style = { captionsPanelStyles.readAloudButton as ViewStyle }>
                            <Icon
                                color = { transcribeOwnSpeech
                                    ? captionsPanelStyles.statusDot.backgroundColor
                                    : captionsPanelStyles.statusText.color }
                                size = { 20 }
                                src = { transcribeOwnSpeech ? IconMic : IconMicSlash } />
                        </TouchableOpacity>
                    )
                }
                {
                    isCaptionTtsSupported() && (
                        <TouchableOpacity
                            accessibilityLabel = { t('captionTts.readAloud') }
                            hitSlop = {{ bottom: 8,
                                left: 8,
                                right: 8,
                                top: 8 }}
                            onPress = { onToggleReadAloud }
                            style = { captionsPanelStyles.readAloudButton as ViewStyle }>
                            <Icon
                                color = { readAloud
                                    ? captionsPanelStyles.statusDot.backgroundColor
                                    : captionsPanelStyles.statusText.color }
                                size = { 20 }
                                src = { readAloud ? IconVolumeUp : IconVolumeOff } />
                        </TouchableOpacity>
                    )
                }
                <TouchableOpacity
                    accessibilityLabel = { t('dialog.close') }
                    hitSlop = {{ bottom: 8,
                        left: 8,
                        right: 8,
                        top: 8 }}
                    onPress = { onClose }>
                    <Icon
                        color = { captionsPanelStyles.statusText.color }
                        size = { 18 }
                        src = { IconCloseLarge } />
                </TouchableOpacity>
            </View>

            {
                readAloud && captionsActive && (
                    <Text style = { captionsPanelStyles.readAloudHint }>
                        { t('captionsPanel.voicesMuted') }
                    </Text>
                )
            }

            {
                transcribeOwnSpeech && (
                    <Text style = { captionsPanelStyles.readAloudHint }>
                        {
                            transcribeError
                                ? t('liveTranscribe.serviceUnavailable')
                                : t('liveTranscribe.transcribeOwnSpeechHint')
                        }
                    </Text>
                )
            }

            <ScrollView
                contentContainerStyle = { [
                    captionsPanelStyles.transcript,
                    { paddingBottom: CAPTIONS_PANEL_TOOLBAR_RESERVE + safeAreaBottom }
                ] as ViewStyle[] }
                ref = { scrollViewRef }>
                {
                    pairs.length === 0
                        ? (
                            <Text style = { captionsPanelStyles.emptyText }>
                                { t('closedCaptionsTab.noMessages') }
                            </Text>
                        )
                        : pairs.map(({ subtitle, translation }) => (
                            <CaptionTranslationPair
                                key = { subtitle.id }
                                subtitle = { subtitle }
                                targetLanguage = { toLanguage }
                                translation = { translation } />
                        ))
                }
            </ScrollView>

            {
                expandedSelector && (
                    <View style = { captionsPanelStyles.dropdown as ViewStyle }>
                        <TextInput
                            autoCorrect = { false }
                            onChangeText = { setSearch }
                            placeholder = { t('voiceTranslation.searchLanguages') }
                            placeholderTextColor = { captionsPanelStyles.selectorCode.color }
                            style = { captionsPanelStyles.searchInput }
                            value = { search } />
                        <ScrollView keyboardShouldPersistTaps = 'handled'>
                            {
                                filteredLanguages.map(language => (
                                    <TouchableHighlight
                                        key = { language.code }
                                        onPress = { () => onSelectLanguage(language.code) }
                                        underlayColor = 'rgba(0, 0, 0, 0.04)'>
                                        <View style = { captionsPanelStyles.dropdownRow as ViewStyle }>
                                            <Text style = { captionsPanelStyles.dropdownRowText }>
                                                { language.name }
                                            </Text>
                                            {
                                                language.code === selectedCode && (
                                                    <Icon
                                                        color = { captionsPanelStyles.statusDot.backgroundColor }
                                                        size = { 18 }
                                                        src = { IconCheck } />
                                                )
                                            }
                                        </View>
                                    </TouchableHighlight>
                                ))
                            }
                        </ScrollView>
                    </View>
                )
            }
        </View>
    );
}
