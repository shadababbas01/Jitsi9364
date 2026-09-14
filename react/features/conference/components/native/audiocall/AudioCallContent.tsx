import React, { useCallback } from 'react';
import { View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import { openSheet } from '../../../../base/dialog/actions';
import { IconDotsVertical } from '../../../../base/icons/svg';
import S2SV2PanelButton from '../../../../s2s-v2/components/native/S2SV2PanelButton';
import S2SV2TranslationPanel from '../../../../s2s-v2/components/native/S2SV2TranslationPanel';
import { getS2SV2State } from '../../../../s2s-v2/functions';
import LiveCaptionsPanel from '../../../../subtitles/components/native/LiveCaptionsPanel';
import OverflowMenu from '../../../../toolbox/components/native/OverflowMenu';

import AudioCallToolbox from './AudioCallToolbox';
import CalleeDetails from './CalleeDetails';
import IconCircleButton from './IconCircleButton';
import styles from './styles';

/**
 * The dedicated phone-call-style content rendered in place of the normal video UI for
 * audio-only calls. Also hosts the same overflow menu, live-captions ("Live Speech
 * Translation") and voice-translation panels used on the regular video call screen, so
 * selecting either from the menu here behaves identically and keeps working if the call
 * later switches back to video.
 *
 * @returns {JSX.Element}
 */
const AudioCallContent = (): JSX.Element => {
    const dispatch = useDispatch();
    const translationPanelOpen = useSelector(
        (state: IReduxState) => getS2SV2State(state).showPanel);

    const onPressOverflow = useCallback(() => {
        // @ts-ignore
        dispatch(openSheet(OverflowMenu));
    }, [ dispatch ]);

    return (
        <SafeAreaView style = { styles.conference as ViewStyle }>
            <IconCircleButton
                accessibilityLabel = 'toolbar.accessibilityLabel.moreActions'
                circleStyle = { styles.overflowButton }
                icon = { IconDotsVertical }
                onPress = { onPressOverflow } />
            <View
                pointerEvents = { translationPanelOpen ? 'none' : 'auto' }
                style = { styles.translationButton as ViewStyle }>
                <S2SV2PanelButton styles = { styles.translationButtonStyles } />
            </View>
            <View style = { styles.calleeArea as ViewStyle }>
                <CalleeDetails />
                <LiveCaptionsPanel />
                <S2SV2TranslationPanel />
            </View>
            <AudioCallToolbox />
        </SafeAreaView>
    );
};

export default AudioCallContent;
