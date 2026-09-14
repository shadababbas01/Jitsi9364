import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeModules } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import { IconPause, IconPlay } from '../../../../base/icons/svg';
import { setAudioMuted } from '../../../../base/media/actions';
import { MEDIA_TYPE } from '../../../../base/media/constants';
import { isLocalTrackMuted } from '../../../../base/tracks/functions.native';

import IconCircleButton from './IconCircleButton';
import ToolboxColumn from './ToolboxColumn';
import styles from './styles';

const { OpenMelpChat } = NativeModules;

/**
 * The hold button. Puts the call "on hold" by muting the microphone (the one part of the old
 * hold flow that still has a real effect - the native `holdclick` notification is kept for
 * parity, but its native implementation is currently a no-op), and restores whatever the
 * microphone's mute state was before hold was pressed.
 *
 * @returns {JSX.Element}
 */
const HoldButton = (): JSX.Element => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const audioMuted = useSelector(
        (state: IReduxState) => isLocalTrackMuted(state['features/base/tracks'], MEDIA_TYPE.AUDIO));
    const [ isHoldOn, setIsHoldOn ] = useState(false);
    const [ preHoldAudioMuted, setPreHoldAudioMuted ] = useState(false);

    const onPress = useCallback(() => {
        if (!isHoldOn) {
            setPreHoldAudioMuted(audioMuted);
            dispatch(setAudioMuted(true, /* ensureTrack */ true));
        } else {
            dispatch(setAudioMuted(preHoldAudioMuted, /* ensureTrack */ true));
        }

        OpenMelpChat?.holdclick?.(!isHoldOn);
        setIsHoldOn(!isHoldOn);
    }, [ audioMuted, dispatch, isHoldOn, preHoldAudioMuted ]);

    return (
        <ToolboxColumn caption = { t(isHoldOn ? 'audioCall.actions.resume' : 'audioCall.actions.hold') }>
            <IconCircleButton
                accessibilityLabel = 'audioCall.actions.hold'
                circleStyle = { isHoldOn ? styles.iconCircleActive : undefined }
                icon = { isHoldOn ? IconPlay : IconPause }
                iconStyle = { isHoldOn ? styles.iconActive : undefined }
                onPress = { onPress } />
        </ToolboxColumn>
    );
};

export default HoldButton;
