import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeModules, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import { openSheet } from '../../../../base/dialog/actions';
import {
    IconAddUser,
    IconBluetooth,
    IconScreenshare,
    IconUsers,
    IconVolumeOff,
    IconVolumeUpBlack
} from '../../../../base/icons/svg';
import { getRemoteParticipants } from '../../../../base/participants/functions';
import ChatButton from '../../../../chat/components/native/ChatButton';
import AudioRoutePickerDialog from '../../../../mobile/audio-mode/components/AudioRoutePickerDialog';
import {
    AUDIO_DEVICE_BLUETOOTH,
    AUDIO_DEVICE_CAR,
    AUDIO_DEVICE_EARPIECE,
    AUDIO_DEVICE_HEADPHONES,
    AUDIO_DEVICE_SPEAKER
} from '../../../../mobile/audio-mode/constants';
import { getAudioDevices, getSelectedAudioDevice, selectAudioDevice } from '../../../../mobile/audio-mode/functions';
import { open as openParticipantsPane } from '../../../../participants-pane/actions.native';
import HangupButton from '../../../../toolbox/components/HangupButton';
import VideoMuteButton from '../../../../toolbox/components/native/VideoMuteButton';

import HoldButton from './HoldButton';
import IconCircleButton from './IconCircleButton';
import MuteButton from './MuteButton';
import ToolboxColumn from './ToolboxColumn';
import styles from './styles';

const inactiveButtonStyles = {
    iconStyle: styles.icon,
    style: styles.iconCircle,
    underlayColor: 'transparent'
};

const activeButtonStyles = {
    iconStyle: styles.iconActive,
    style: styles.iconCircleActive,
    underlayColor: 'transparent'
};

const hangupButtonStyles = {
    iconStyle: styles.hangupIcon,
    style: styles.hangupCircle,
    underlayColor: 'transparent'
};

const { NativeCallsNew } = NativeModules;

/**
 * The toolbox of the dedicated audio-only call screen: a phone-call-style grid of actions,
 * matching the layout and native calls of the original audio-call screen (branch 23feb2026).
 *
 * @returns {JSX.Element}
 */
const AudioCallToolbox = (): JSX.Element => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const remoteParticipants = useSelector((state: IReduxState) => getRemoteParticipants(state));
    const audioDevices = useSelector((state: IReduxState) => getAudioDevices(state));
    const selectedAudioDevice = useSelector((state: IReduxState) => getSelectedAudioDevice(state));

    const attendeeEmails = useMemo(
        () => Array.from(remoteParticipants.values())
            .map(participant => participant.email)
            .filter(Boolean),
        [ remoteParticipants ]
    );

    const onPressAttendees = useCallback(
        () => NativeCallsNew?.showAttendees?.(attendeeEmails),
        [ attendeeEmails ]
    );

    const onPressAddCall = useCallback(() => {
        NativeCallsNew?.showAttendees?.(attendeeEmails);
        dispatch(openParticipantsPane());
    }, [ attendeeEmails, dispatch ]);

    const hasBluetoothDevice = audioDevices.some(
        device => device.type === AUDIO_DEVICE_BLUETOOTH || device.type === AUDIO_DEVICE_CAR);

    const onPressSpeaker = useCallback(() => {
        if (hasBluetoothDevice) {
            // With a bluetooth/car route in play there are more than two routes to choose between,
            // so fall back to letting the user pick one explicitly, same as the regular toolbox button.
            dispatch(openSheet(AudioRoutePickerDialog));

            return;
        }

        selectAudioDevice(
            selectedAudioDevice?.type === AUDIO_DEVICE_SPEAKER ? AUDIO_DEVICE_EARPIECE : AUDIO_DEVICE_SPEAKER);
    }, [ dispatch, hasBluetoothDevice, selectedAudioDevice ]);

    const isSpeakerActive = selectedAudioDevice?.type === AUDIO_DEVICE_SPEAKER
        || selectedAudioDevice?.type === AUDIO_DEVICE_BLUETOOTH
        || selectedAudioDevice?.type === AUDIO_DEVICE_CAR;

    let speakerCaption = t('audioCall.actions.speakerOff');
    let speakerIcon = IconVolumeOff;

    switch (selectedAudioDevice?.type) {
    case AUDIO_DEVICE_SPEAKER:
        speakerCaption = t('audioCall.actions.speakerOn');
        speakerIcon = IconVolumeUpBlack;
        break;
    case AUDIO_DEVICE_BLUETOOTH:
    case AUDIO_DEVICE_CAR:
        speakerCaption = t('audioDevices.bluetooth');
        speakerIcon = IconBluetooth;
        break;
    case AUDIO_DEVICE_HEADPHONES:
        speakerCaption = t('audioDevices.headphones');
        break;
    }

    const speakerButtonStyles = isSpeakerActive ? activeButtonStyles : inactiveButtonStyles;

    return (
        <View style = { styles.toolboxContainer as ViewStyle }>
            <View style = { styles.toolboxRow as ViewStyle }>
                <ToolboxColumn caption = { t('audioCall.actions.dialpad') }>
                    <IconCircleButton
                        accessibilityLabel = 'audioCall.actions.dialpad'
                        disabled = { true }
                        icon = { IconScreenshare } />
                </ToolboxColumn>
                <ToolboxColumn caption = { t('audioCall.actions.attendees') }>
                    <IconCircleButton
                        accessibilityLabel = 'audioCall.actions.attendees'
                        icon = { IconAddUser }
                        onPress = { onPressAttendees } />
                </ToolboxColumn>
                <ToolboxColumn caption = { t('audioCall.actions.addCall') }>
                    <IconCircleButton
                        accessibilityLabel = 'audioCall.actions.addCall'
                        icon = { IconUsers }
                        onPress = { onPressAddCall } />
                </ToolboxColumn>
            </View>

            <View style = { styles.toolboxRow as ViewStyle }>
                <ToolboxColumn caption = { t('toolbar.mute') }>
                    <MuteButton
                        styles = { inactiveButtonStyles }
                        toggledStyles = { activeButtonStyles } />
                </ToolboxColumn>
                <ToolboxColumn caption = { t('toolbar.videomute') }>
                    <VideoMuteButton styles = { inactiveButtonStyles } />
                </ToolboxColumn>
                <ToolboxColumn caption = { speakerCaption }>
                    <IconCircleButton
                        accessibilityLabel = 'toolbar.accessibilityLabel.audioRoute'
                        circleStyle = { speakerButtonStyles.style }
                        icon = { speakerIcon }
                        iconStyle = { speakerButtonStyles.iconStyle }
                        onPress = { onPressSpeaker } />
                </ToolboxColumn>
            </View>

            <View style = { styles.toolboxRow as ViewStyle }>
                <ToolboxColumn caption = { t('toolbar.chat') }>
                    <ChatButton styles = { inactiveButtonStyles } />
                </ToolboxColumn>
                <ToolboxColumn caption = { t('toolbar.hangup') }>
                    <HangupButton styles = { hangupButtonStyles } />
                </ToolboxColumn>
                <HoldButton />
            </View>
        </View>
    );
};

export default AudioCallToolbox;
