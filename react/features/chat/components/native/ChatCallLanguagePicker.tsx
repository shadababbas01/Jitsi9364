import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TextStyle,
    TouchableHighlight,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconArrowDown, IconCheck } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import { getChatReadAloudLanguage } from '../../../caption-tts/functions.native';
import {
    ILiveCaptionsLanguage,
    fetchLiveCaptionsLanguages,
    toBaseSubtitlesLanguage
} from '../../../subtitles/languages';

import { chatCallStyles as styles } from './styles';

/**
 * The languages to fall back on while the list is being fetched, or if fetching it fails.
 */
const FALLBACK_CODES = [ 'en', 'hi', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'pt', 'ru' ];

/**
 * The language incoming messages are translated into before being read aloud, and the sheet for changing it. Picking a
 * language changes what is heard rather than anything on screen: nothing another participant sends is written out.
 *
 * @returns {JSX.Element}
 */
export default function ChatCallLanguagePicker() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const selected = useSelector((state: IReduxState) => getChatReadAloudLanguage(state));

    const [ languages, setLanguages ] = useState<ILiveCaptionsLanguage[]>([]);
    const [ open, setOpen ] = useState(false);
    const [ search, setSearch ] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetchLiveCaptionsLanguages(FALLBACK_CODES).then(fetched => {
            if (!cancelled) {
                setLanguages(fetched);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedLabel = useMemo(() => {
        const match = languages.find(language => language.code === selected);

        return match?.label || selected.toUpperCase() || t('chat.call.noTranslation');
    }, [ languages, selected, t ]);

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return languages;
        }

        return languages.filter(language => language.label.toLowerCase().includes(needle)
            || language.code.toLowerCase().includes(needle));
    }, [ languages, search ]);

    const openSheet = useCallback(() => setOpen(true), []);

    const closeSheet = useCallback(() => {
        setOpen(false);
        setSearch('');
    }, []);

    const select = useCallback((code: string) => {
        dispatch(updateSettings({ chatReadAloudLanguage: code }));
        closeSheet();
    }, [ closeSheet, dispatch ]);

    return (
        <>
            <Pressable
                accessibilityLabel = { t('chat.call.selectLanguage') }
                accessibilityRole = 'button'
                onPress = { openSheet }
                style = { styles.languagePill as ViewStyle }>
                <Text style = { styles.languagePillText as TextStyle }>
                    { selectedLabel }
                </Text>
                <Icon
                    color = '#FFFFFF'
                    size = { 14 }
                    src = { IconArrowDown } />
            </Pressable>

            <Modal
                animationType = 'slide'
                onRequestClose = { closeSheet }
                transparent = { true }
                visible = { open }>
                <Pressable
                    onPress = { closeSheet }
                    style = { styles.pickerBackdrop as ViewStyle }>
                    {/* Swallows the press so tapping inside the sheet does not close it. */}
                    <Pressable style = { styles.pickerSheet as ViewStyle }>
                        <Text style = { styles.pickerTitle as TextStyle }>
                            { t('chat.call.selectLanguage') }
                        </Text>
                        <TextInput
                            autoCorrect = { false }
                            onChangeText = { setSearch }
                            placeholder = { t('chat.call.searchLanguages') }
                            placeholderTextColor = 'rgba(255, 255, 255, 0.45)'
                            style = { styles.pickerSearch as TextStyle }
                            value = { search } />
                        <ScrollView keyboardShouldPersistTaps = 'handled'>
                            { filtered.map(language => (
                                <TouchableHighlight
                                    key = { language.code }

                                    /* eslint-disable-next-line react/jsx-no-bind */
                                    onPress = { () => select(language.code) }
                                    underlayColor = 'rgba(255, 255, 255, 0.08)'>
                                    <View style = { styles.pickerRow as ViewStyle }>
                                        <Text style = { styles.pickerRowText as TextStyle }>
                                            { language.label }
                                        </Text>
                                        { toBaseSubtitlesLanguage(language.code) === toBaseSubtitlesLanguage(selected)
                                            && (
                                                <Icon
                                                    color = '#7CE39B'
                                                    size = { 18 }
                                                    src = { IconCheck } />
                                            ) }
                                    </View>
                                </TouchableHighlight>
                            )) }
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
