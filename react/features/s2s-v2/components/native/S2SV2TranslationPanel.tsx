import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Pressable,
    ScrollView,
    Text,
    TextStyle,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconCloseLarge, IconTheme, IconVolumeOff, IconVolumeUp } from '../../../base/icons/svg';
import { isLocalParticipantModerator } from '../../../base/participants/functions';
import {
    setS2SV2PanelVisible,
    setS2SV2StopConfirmVisible,
    setS2SV2SuppressOriginalVoice,
    setS2SV2TargetLanguage,
    setS2SV2Theme
} from '../../actions';
import {
    getS2SV2PanelHeight,
    getS2SV2SpeakingMessageId,
    getS2SV2State,
    getS2SV2TargetLanguage,
    getS2SV2Theme,
    getS2SV2Transcripts,
    isEnglish,
    isS2SV2Active,
    shouldSuppressOriginalVoice
} from '../../functions';

import S2SV2LanguageDropdown from './S2SV2LanguageDropdown';
import S2SV2TranscriptRow from './S2SV2TranscriptRow';
import getS2SV2PanelStyles from './panelStyles';
import useS2SV2SurfaceTap from './useS2SV2SurfaceTap';
import useS2SV2SwipeDismiss from './useS2SV2SwipeDismiss';

interface IProps {

    /**
     * Called on a tap which lands on the panel rather than on one of its controls.
     *
     * The conference's own tap handler, the very one the tile grid and the large video are given, so that a tap on the
     * panel shows and hides the toolbar exactly as a tap on the video behind it does. Deliberately not worked out here:
     * a second copy of "is the toolbar visible, so hide it" is a second copy which can disagree with the first.
     */
    onPress?: () => void;
}

/**
 * Speech-to-speech translation panel.
 *
 * The transcript consumes all remaining available vertical space.
 *
 * Controls at the bottom:
 * - Target/listening language.
 * - Original voice enable/disable.
 *
 * Header controls:
 * - Light/dark theme.
 * - Close panel.
 *
 * Closing this panel only hides it. It does not stop the translation session.
 *
 * @returns {JSX.Element|null}
 */
export default function S2SV2TranslationPanel({ onPress }: IProps) {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const active = useSelector(isS2SV2Active);

    const visible = useSelector(
        (state: IReduxState) => getS2SV2State(state).showPanel
    );

    const multipleSpeakers = useSelector(
        (state: IReduxState) =>
            getS2SV2State(state).multipleSpeakersDetected
    );

    const translating = useSelector(
        (state: IReduxState) =>
            getS2SV2State(state).translating
    );
    const speakingMessageId = useSelector(getS2SV2SpeakingMessageId);

    const measuredHeight = useSelector(getS2SV2PanelHeight);
    const language = useSelector(getS2SV2TargetLanguage);
    const suppress = useSelector(shouldSuppressOriginalVoice);
    const theme = useSelector(getS2SV2Theme);
    const transcripts = useSelector(getS2SV2Transcripts);

    const moderator = useSelector(
        (state: IReduxState) =>
            isLocalParticipantModerator(state)
    );

    const styles = getS2SV2PanelStyles(theme);

    const list = useRef<ScrollView>(null);

    /**
     * Only hide the panel.
     *
     * Translation/session remains running.
     */
    const close = useCallback(
        () => dispatch(setS2SV2PanelVisible(false)),
        [ dispatch ]
    );

    /**
     * Pulling the panel down by its grabber puts it away, exactly as the X in the header does: hidden, still running.
     *
     * Nothing contains this panel - it is drawn straight into the conference - so it does its own sliding out, and the
     * X in the header goes through the same slide rather than switching the panel off where it stands.
     */
    const { dismiss, handlers, onLayout, translateY } = useS2SV2SwipeDismiss(close, {
        animateExit: true,
        visible: active && visible
    });

    /**
     * A tap anywhere the panel is not already using shows and hides the toolbar, so the panel behaves like the video
     * underneath it rather than like a hole in the screen where tapping stops working.
     */
    const { claim, handlers: tapHandlers } = useS2SV2SurfaceTap(
        useCallback(() => onPress?.(), [ onPress ])
    );

    const selectLanguage = useCallback(
        (code: string) => dispatch(setS2SV2TargetLanguage(code)),
        [ dispatch ]
    );

    const toggleTheme = useCallback(
        () => dispatch(setS2SV2Theme(theme === 'dark' ? 'light' : 'dark')),
        [ dispatch, theme ]
    );

    const toggleOriginalVoice = useCallback(
        () => {
            dispatch(
                setS2SV2SuppressOriginalVoice(!suppress)
            );
        },
        [ dispatch, suppress ]
    );

    /**
     * Moderator-only action to stop translation
     * for everyone.
     */
    const closeTranscript = useCallback(
        () =>
            dispatch(setS2SV2StopConfirmVisible(true)),
        [ dispatch ]
    );

    /**
     * Keep transcript following the newest message.
     */
    const follow = useCallback(
        () => {
            list.current?.scrollToEnd({
                animated: true
            });
        },
        []
    );

    if (!active || !visible) {
        return null;
    }

    const needsTranslation
        = Boolean(language)
        && !isEnglish(language);

    const height = measuredHeight || '50%';
    const iconColor = theme === 'dark' ? '#FFFFFF' : '#202124';

    return (
        <Animated.View
            onLayout = { onLayout }
            style = {
                [
                    styles.panel,
                    {
                        height,
                        transform: [ { translateY } ]
                    }
                ] as ViewStyle[]
            }>
            <View style = { styles.topRow as ViewStyle }>
                <Pressable
                    accessibilityLabel = { t('s2sV2.panel.theme.label') }
                    accessibilityRole = 'button'
                    onPress = { toggleTheme }
                    style = { styles.headerIconButton as ViewStyle }>
                    <Icon
                        color = { iconColor }
                        size = { 12 }
                        src = { IconTheme } />
                </Pressable>

                <View
                    { ...handlers }
                    style = { styles.grabberWrap as ViewStyle }>
                    <View style = { styles.grabber as ViewStyle } />
                </View>

                <Pressable
                    accessibilityLabel = { t('dialog.close') }
                    accessibilityRole = 'button'
                    onPress = { dismiss }
                    style = { styles.headerIconButton as ViewStyle }>
                    <Icon
                        color = { iconColor }
                        size = { 12 }
                        src = { IconCloseLarge } />
                </Pressable>
            </View>

            <View
                { ...tapHandlers }
                style = { styles.panelBody as ViewStyle }>

                {/*
                 * ============================================================
                 * MULTIPLE SPEAKERS INDICATOR
                 * ============================================================
                 */}
                { multipleSpeakers && (
                    <View
                        accessibilityLiveRegion = 'polite'
                        style = {
                            styles.speakersChip as ViewStyle
                        }>
                        <Text
                            style = {
                                styles.speakersChipLabel as TextStyle
                            }>
                            {
                                t(
                                    's2sV2.multipleSpeakers.label'
                                )
                            }
                        </Text>
                    </View>
                ) }

                {/*
                 * ============================================================
                 * TRANSCRIPT
                 * ============================================================
                 *
                 * flex: 1 makes the transcript consume all space left
                 * after the header, controls and footer.
                 *
                 * minHeight: 0 is important for ScrollView inside a flex
                 * layout on React Native.
                 */}
                <View
                    style = {
                        [
                            styles.transcriptCard,
                            {
                                flex: 1,
                                minHeight: 0
                            }
                        ] as ViewStyle[]
                    }>

                    { transcripts.length === 0 ? (
                        <Text
                            style = {
                                styles.transcriptEmpty as TextStyle
                            }>
                            {
                                t('s2sV2.panel.empty')
                            }
                        </Text>
                    ) : (
                        <ScrollView
                            accessibilityLiveRegion = 'polite'
                            contentContainerStyle = {
                                [
                                    styles.transcriptContent,
                                    {
                                        flexGrow: 1
                                    }
                                ] as ViewStyle[]
                            }
                            keyboardShouldPersistTaps = 'handled'
                            onContentSizeChange = { follow }
                            ref = { list }
                            showsVerticalScrollIndicator = { false }
                            style = {
                                [
                                    styles.transcriptScroll,
                                    {
                                        flex: 1
                                    }
                                ] as ViewStyle[]
                            }>

                            {
                                transcripts.map(
                                    (entry, index) => (
                                        <S2SV2TranscriptRow
                                            entry = { entry }
                                            first = { index === 0 }
                                            key = {
                                                entry.messageId
                                            }
                                            pending = {
                                                needsTranslation
                                                && Boolean(
                                                    translating[
                                                        entry
                                                            .messageId
                                                    ]
                                                )
                                            }
                                            speaking = {
                                                speakingMessageId === entry.messageId
                                            }
                                            theme = { theme } />
                                    )
                                )
                            }
                        </ScrollView>
                    ) }
                </View>

                <View style = { styles.controlRow as ViewStyle }>
                    <View
                        { ...claim }
                        style = { styles.languageDropdown as ViewStyle }>
                        <S2SV2LanguageDropdown
                            accessibilityLabel = { t('s2sV2.panel.languageLabel') }
                            caption = { t('s2sV2.panel.listenIn') }
                            label = { t('s2sV2.panel.languageHelper') }
                            onSelect = { selectLanguage }
                            theme = { theme }
                            value = { language } />
                    </View>

                    <Pressable
                        accessibilityLabel = {
                            suppress
                                ? t('s2sV2.panel.suppressOnHelper')
                                : t('s2sV2.panel.suppressOffHelper')
                        }
                        accessibilityRole = 'button'
                        accessibilityState = {{
                            checked: suppress
                        }}
                        { ...claim }
                        hitSlop = { 6 }
                        onPress = { toggleOriginalVoice }
                        style = { [
                            styles.squareButton,
                            suppress ? styles.squareButtonActive : styles.squareButtonInactive
                        ] as ViewStyle[] }>
                        <Icon
                            color = { iconColor }
                            size = { 18 }
                            src = { suppress ? IconVolumeOff : IconVolumeUp } />
                    </Pressable>
                </View>

                {/*
                 * ============================================================
                 * FOOTER
                 * ============================================================
                 */}
                <View
                    style = {
                        [
                            styles.panelFooter,
                            {
                                flexShrink: 0
                            }
                        ] as ViewStyle[]
                    }>

                    <Text
                        style = {
                            styles.disclaimer as TextStyle
                        }>
                        {
                            t(
                                's2sV2.panel.disclaimer'
                            )
                        }
                    </Text>

                    {/*
                     * Only moderators can stop translation for everyone.
                     *
                     * The X button in the header merely hides the panel.
                     */}
                    { moderator && (
                        <Pressable
                            accessibilityLabel = {
                                t(
                                    's2sV2.panel.closeTranscript'
                                )
                            }
                            { ...claim }
                            accessibilityRole = 'button'
                            onPress = { closeTranscript }
                            style = {
                                styles.closeTranscript as ViewStyle
                            }>
                            <Text
                                style = {
                                    styles.closeTranscriptLabel as TextStyle
                                }>
                                {
                                    t(
                                        's2sV2.panel.closeTranscript'
                                    )
                                }
                            </Text>
                        </Pressable>
                    ) }
                </View>
            </View>
        </Animated.View>
    );
}
