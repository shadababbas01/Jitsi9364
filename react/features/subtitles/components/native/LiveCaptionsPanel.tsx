import React, { useCallback, useMemo, useRef } from 'react';
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
import { IconCloseLarge, IconTheme } from '../../../base/icons/svg';
import { isLocalParticipantModerator } from '../../../base/participants/functions';
import { getSpeakingCaptionId } from '../../../caption-tts/functions.any';
import { setS2SV2Theme } from '../../../s2s-v2/actions';
import S2SV2LanguageDropdown from '../../../s2s-v2/components/native/S2SV2LanguageDropdown';
import getS2SV2PanelStyles from '../../../s2s-v2/components/native/panelStyles';
import useS2SV2SurfaceTap from '../../../s2s-v2/components/native/useS2SV2SurfaceTap';
import useS2SV2SwipeDismiss from '../../../s2s-v2/components/native/useS2SV2SwipeDismiss';
import { getS2SV2Theme } from '../../../s2s-v2/functions';
import {
    setCaptionsStopConfirmVisible,
    setSubtitlesLanguage,
    setSubtitlesPanelOpen
} from '../../actions.any';
import { CAPTIONS_STT_LANGUAGE } from '../../constants';
import { getCaptionsPanelHeight, isLiveTranscriptionActive } from '../../functions.any';
import { normalizeSubtitlesLanguage, toSubtitlesLanguageValue } from '../../languages';
import { ISubtitle } from '../../types';

import LiveCaptionRow from './LiveCaptionRow';

interface IProps {

    /**
     * Called on a tap which lands on the panel rather than on one of its controls.
     *
     * The conference's own tap handler, the very one the tile grid and the large video are given, so that a tap on the
     * panel shows and hides the toolbar exactly as a tap on the video behind it does.
     */
    onPress?: () => void;
}

/**
 * Collapses the caption history to the lines worth showing.
 *
 * Two things have to come out. Translations the transcriber sent as captions of their own would otherwise be listed
 * beside the lines they translate rather than underneath them, and an interim caption is the same sentence being
 * dictated - only the newest per speaker is the current state of it, and the ones before it are drafts which would
 * push the finished lines around as they arrive.
 *
 * @param {ISubtitle[]} history - Everything said so far.
 * @returns {ISubtitle[]}
 */
function _visibleCaptions(history: ISubtitle[]): ISubtitle[] {
    const transcriptions = history.filter(subtitle => subtitle.isTranscription && subtitle.text?.trim());
    const latestInterim = new Map<string, ISubtitle>();

    for (const subtitle of transcriptions) {
        if (!subtitle.interim || !subtitle.participantId) {
            continue;
        }

        const existing = latestInterim.get(subtitle.participantId);

        if (!existing || Number(subtitle.timestamp) >= Number(existing.timestamp)) {
            latestInterim.set(subtitle.participantId, subtitle);
        }
    }

    const live = new Set(Array.from(latestInterim.values()).map(subtitle => subtitle.id));

    return [
        ...transcriptions.filter(subtitle => !subtitle.interim && !live.has(subtitle.id)),
        ...Array.from(latestInterim.values())
    ].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

/**
 * Live speech translation panel.
 *
 * The same panel as the speech-to-speech one, down to the styles it is built from, because to anybody looking at it it
 * is the same thing: a transcript of the room with a language control under it, in the room the tile grid gives up.
 * Two panels which do the same job and look different would read as two unrelated features rather than as one idea
 * offered twice.
 *
 * The transcript consumes all remaining vertical space.
 *
 * Controls at the bottom:
 * - The language everything is read in on this device.
 * - Whether captions are read aloud.
 *
 * Header controls:
 * - Light/dark theme.
 * - Ask to stop captions.
 *
 * Swiping this panel down only hides it. The close icon asks for confirmation before stopping captions.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element|null}
 */
export default function LiveCaptionsPanel({ onPress }: IProps) {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const active = useSelector(isLiveTranscriptionActive);
    const visible = useSelector((state: IReduxState) => state['features/subtitles'].panelOpen);
    const measuredHeight = useSelector(getCaptionsPanelHeight);
    const history = useSelector((state: IReduxState) => state['features/subtitles'].subtitlesHistory);
    const language = useSelector((state: IReduxState) => state['features/subtitles']._language);
    const speakingId = useSelector(getSpeakingCaptionId);
    const moderator = useSelector(isLocalParticipantModerator);
    const startedByMe = useSelector((state: IReduxState) =>
        Boolean(state['features/chat'].transcriptionStartedByCurrentUser));

    // Ending it takes something away from everybody, so it is offered to the people it belongs to: a moderator, and
    // whoever actually started it. A participant who was given the session cannot take it back off the room.
    const canStop = moderator || startedByMe;

    // Shared with the speech-to-speech panel on purpose. Which of the two ways a panel is drawn is a display
    // preference of this reader's, not a property of either session, and somebody who set one panel to light has said
    // what they want the other one to be as well.
    const theme = useSelector(getS2SV2Theme);

    const styles = getS2SV2PanelStyles(theme);
    const list = useRef<ScrollView>(null);
    const captions = useMemo(() => _visibleCaptions(history), [ history ]);
    // English rather than nothing when the reader has not chosen. An empty value makes the control read "Loading
    // languages", which is both untrue - the transcript arrives in English and needs no translating to be read - and
    // the first thing anybody sees when they open the panel.
    const selected = normalizeSubtitlesLanguage(language) || CAPTIONS_STT_LANGUAGE;

    /**
     * Only hide the panel. Captions carry on running for the room.
     */
    const close = useCallback(
        () => dispatch(setSubtitlesPanelOpen(false)),
        [ dispatch ]
    );

    /**
     * Pulling the panel down by its grabber puts it away: hidden, still running.
     */
    const { handlers, onLayout, translateY } = useS2SV2SwipeDismiss(close, {
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
        (code: string) => dispatch(setSubtitlesLanguage(toSubtitlesLanguageValue(code))),
        [ dispatch ]
    );

    const toggleTheme = useCallback(
        () => dispatch(setS2SV2Theme(theme === 'dark' ? 'light' : 'dark')),
        [ dispatch, theme ]
    );

    /**
     * Asks for confirmation before live captions are stopped for the whole room.
     */
    const confirmStopCaptions = useCallback(
        () => dispatch(setCaptionsStopConfirmVisible(true)),
        [ dispatch ]
    );

    /**
     * Keep the transcript following the newest caption.
     */
    const follow = useCallback(
        () => list.current?.scrollToEnd({ animated: true }),
        []
    );

    if (!active || !visible) {
        return null;
    }

    const height = measuredHeight || '50%';
    const iconColor = theme === 'dark' ? '#FFFFFF' : '#202124';

    return (
        <Animated.View
            onLayout = { onLayout }
            style = { [
                styles.panel,
                {
                    height,
                    transform: [ { translateY } ]
                }
            ] as ViewStyle[] }>
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
                    onPress = { confirmStopCaptions }
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

                <View
                    style = { [
                        styles.transcriptCard,
                        {
                            flex: 1,
                            minHeight: 0
                        }
                    ] as ViewStyle[] }>

                    { captions.length === 0 ? (
                        <Text style = { styles.transcriptEmpty as TextStyle }>
                            { t('liveCaptionsPanel.empty') }
                        </Text>
                    ) : (
                        <ScrollView
                            accessibilityLiveRegion = 'polite'
                            contentContainerStyle = { [
                                styles.transcriptContent,
                                { flexGrow: 1 }
                            ] as ViewStyle[] }
                            keyboardShouldPersistTaps = 'handled'
                            onContentSizeChange = { follow }
                            ref = { list }
                            showsVerticalScrollIndicator = { false }
                            style = { [
                                styles.transcriptScroll,
                                { flex: 1 }
                            ] as ViewStyle[] }>
                            {
                                captions.map((subtitle, index) => (
                                    <LiveCaptionRow
                                        first = { index === 0 }
                                        key = { subtitle.id }
                                        speaking = { speakingId === subtitle.id }
                                        subtitle = { subtitle }
                                        targetLanguage = { language }
                                        theme = { theme } />
                                ))
                            }
                        </ScrollView>
                    ) }
                </View>

                {/*
                  * The language is the only control here. Captions are never read aloud - reading a translation over
                  * a room which is still talking asks the listener to follow two things at once, and the line being
                  * read is always behind the line being said - so there is no loudspeaker toggle beside it.
                  */}
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
                            value = { selected } />
                    </View>

                </View>

                <View
                    style = { [
                        styles.liveCaptionsPanelFooter,
                        { flexShrink: 0 }
                    ] as ViewStyle[] }>

                    <Text
                        adjustsFontSizeToFit = { true }
                        allowFontScaling = { false }
                        minimumFontScale = { 0.65 }
                        numberOfLines = { 1 }
                        style = { styles.liveCaptionsDisclaimer as TextStyle }>
                        { t('liveCaptionsPanel.disclaimer') }
                    </Text>

                    { canStop && (
                        <Pressable
                            accessibilityLabel = { t('liveCaptionsPanel.stop') }
                            { ...claim }
                            accessibilityRole = 'button'
                            onPress = { confirmStopCaptions }
                            style = { [
                                styles.closeTranscript,
                                styles.liveCaptionsStop
                            ] as ViewStyle[] }>
                            <Text style = { styles.closeTranscriptLabel as TextStyle }>
                                { t('liveCaptionsPanel.stop') }
                            </Text>
                        </Pressable>
                    ) }
                </View>
            </View>
        </Animated.View>
    );
}
