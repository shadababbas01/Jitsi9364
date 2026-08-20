import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { hideSheet } from '../../../base/dialog/actions';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import Icon from '../../../base/icons/components/Icon';
import { IconTranslate } from '../../../base/icons/svg';
import { updateSettings } from '../../../base/settings/actions';
import Switch from '../../../base/ui/components/native/Switch';
import { getChatReadAloudLanguage } from '../../../caption-tts/functions.native';
import { isPlayTranslationOnly } from '../../functions.native';

import LanguagePill from './LanguagePill';
import styles, { LIVE_TRANSLATION_COLORS } from './styles';
import useCaptionLanguages from './useCaptionLanguages';

interface IProps {

    /**
     * The name of whoever is asking, which is the whole of what makes their question answerable. Absent when the local
     * user is the one starting the call, and so the one doing the asking.
     */
    inviterName?: string;

    /**
     * Called when the call is joined, or started.
     */
    onAllow: () => void;

    /**
     * Called when the sheet is turned down, including when it is dismissed without answering: somebody who swipes the
     * question away has not agreed to anything.
     */
    onDecline: () => void;

    /**
     * Whether the local user is the one starting the call rather than being asked to join one. The two sides settle the
     * same things; only what the sheet says is about to happen differs.
     */
    starting?: boolean;
}

/**
 * What a translated call sounds like, settled before joining or starting one: which language to hear everybody in, and
 * whether their own voices are silenced underneath it.
 *
 * Both sides of a call answer this same sheet. Starting one and being asked to join one are the same decision made from
 * two ends, and the settings behind it are the local user's own either way - so the person who starts the call is not
 * left with whatever the last call was set to while everybody they invited gets to choose.
 *
 * A sheet at the bottom of the screen rather than a dialog in the middle of it, because it can arrive unannounced during
 * a call and is answered with the thumb of whichever hand is already holding the phone. Nothing is written to the
 * settings until it is saved: somebody who turns it down has changed nothing.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function LiveTranslationInviteSheet({ inviterName, onAllow, onDecline, starting }: IProps) {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const languages = useCaptionLanguages();
    const savedLanguage = useSelector(getChatReadAloudLanguage);
    const savedTranslationOnly = useSelector(isPlayTranslationOnly);

    const [ language, setLanguage ] = useState(savedLanguage);
    const [ translationOnly, setTranslationOnly ] = useState(savedTranslationOnly);

    // The switch hands back an optional boolean, since it is also driven by presses which carry no value.
    const toggle = useCallback((on?: boolean) => setTranslationOnly(Boolean(on)), []);

    const decline = useCallback(() => {
        dispatch(hideSheet());
        onDecline();
    }, [ dispatch, onDecline ]);

    const save = useCallback(() => {
        dispatch(updateSettings({
            chatReadAloudLanguage: language,
            liveTranslationPlayTranslationOnly: translationOnly
        }));
        dispatch(hideSheet());
        onAllow();
    }, [ dispatch, language, onAllow, translationOnly ]);

    return (
        <BottomSheet
            addScrollViewPadding = { false }
            onCancel = { decline }
            style = { styles.inviteSheet }>
            <View style = { styles.grabber as ViewStyle } />
            <View style = { styles.inviteBody as ViewStyle }>
                <View style = { styles.inviteHeader as ViewStyle }>
                    <View style = { styles.inviteIcon as ViewStyle }>
                        <Icon
                            color = { LIVE_TRANSLATION_COLORS.accent }
                            size = { 20 }
                            src = { IconTranslate } />
                    </View>
                    <View style = { styles.inviteHeaderCopy as ViewStyle }>
                        <Text style = { styles.inviteTitle as TextStyle }>
                            { t('liveTranslation.inviteTitle') }
                        </Text>
                        <Text style = { styles.inviteDescription as TextStyle }>
                            { starting
                                ? t('liveTranslation.startDescription')
                                : t('liveTranslation.inviteDescription', { name: inviterName }) }
                        </Text>
                    </View>
                </View>

                <Text style = { styles.inviteFieldLabel as TextStyle }>
                    { t('liveTranslation.listenIn') }
                </Text>
                <LanguagePill
                    accessibilityLabel = { t('liveTranslation.listenIn') }
                    label = { t('liveTranslation.listenInHint') }
                    onSelect = { setLanguage }
                    style = { styles.inviteDropdown as ViewStyle }
                    value = { language } />
                { languages.length > 0 && (
                    <Text style = { styles.inviteFieldHelper as TextStyle }>
                        { t('liveTranslation.languagesSupported', { count: languages.length }) }
                    </Text>
                ) }

                <View style = { styles.inviteDivider as ViewStyle } />

                <View style = { styles.inviteToggleRow as ViewStyle }>
                    <View style = { styles.inviteToggleCopy as ViewStyle }>
                        <Text style = { styles.inviteToggleLabel as TextStyle }>
                            { t('liveTranslation.translationOnly') }
                        </Text>
                        <Text style = { styles.inviteFieldHelper as TextStyle }>
                            { t('liveTranslation.translationOnlyHelper') }
                        </Text>
                    </View>
                    <Switch
                        checked = { translationOnly }
                        onChange = { toggle } />
                </View>

                <View style = { styles.inviteActions as ViewStyle }>
                    <Pressable
                        accessibilityLabel = { t('dialog.Cancel') }
                        accessibilityRole = 'button'
                        onPress = { decline }
                        style = { [ styles.inviteButton, styles.inviteButtonDecline ] as ViewStyle[] }>
                        <Text
                            style = { [
                                styles.inviteButtonLabel,
                                styles.inviteButtonLabelDecline
                            ] as TextStyle[] }>
                            { t('dialog.Cancel') }
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel = { t('dialog.Save') }
                        accessibilityRole = 'button'
                        onPress = { save }
                        style = { [ styles.inviteButton, styles.inviteButtonAccept ] as ViewStyle[] }>
                        <Text
                            style = { [
                                styles.inviteButtonLabel,
                                styles.inviteButtonLabelAccept
                            ] as TextStyle[] }>
                            { t('dialog.Save') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </BottomSheet>
    );
}
