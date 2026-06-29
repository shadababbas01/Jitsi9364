import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { withSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import JitsiScreen from '../../../../base/modal/components/JitsiScreen';
import LoadingIndicator from '../../../../base/react/components/native/LoadingIndicator';
import TintedView from '../../../../base/react/components/native/TintedView';
import { ASPECT_RATIO_WIDE } from '../../../../base/responsive-ui/constants';
import { isLocalVideoTrackDesktop } from '../../../../base/tracks/functions.native';
import { setPictureInPictureEnabled } from '../../../../mobile/picture-in-picture/functions';
import { setIsCarmode } from '../../../../video-layout/actions';
import ConferenceTimer from '../../ConferenceTimer';
import { isConnecting } from '../../functions';

import CarModeFooter from './CarModeFooter';
import MicrophoneButton from './MicrophoneButton';
import TitleBar from './TitleBar';
import styles from './styles';

/**
 * Implements the carmode component.
 *
 * @returns { JSX.Element} - The carmode component.
 */
const CarMode = (): JSX.Element => {
    const dispatch = useDispatch();
    const connecting = useSelector(isConnecting);
    const isSharing = useSelector(isLocalVideoTrackDesktop);
    const isLandscape = useSelector(
        (state: IReduxState) => state['features/base/responsive-ui'].aspectRatio === ASPECT_RATIO_WIDE);

    useEffect(() => {
        dispatch(setIsCarmode(true));
        setPictureInPictureEnabled(false);

        // Car mode supports both orientations; allow the device to rotate
        // freely so the UI can adapt to portrait and landscape.
        Orientation.unlockAllOrientations();

        return () => {
            Orientation.unlockAllOrientations();
            dispatch(setIsCarmode(false));
            if (!isSharing) {
                setPictureInPictureEnabled(true);
            }
        };
    }, []);

    return (
        <JitsiScreen
            footerComponent = { isLandscape ? undefined : CarModeFooter }
            style = { styles.conference }>
            {/*
                  * The activity/loading indicator goes above everything, except
                  * the toolbox/toolbars and the dialogs.
                  */
                connecting
                && <TintedView>
                    <LoadingIndicator />
                </TintedView>
            }
            <View
                pointerEvents = 'box-none'
                style = { styles.titleBarSafeViewColor as ViewStyle }>
                <View
                    style = { styles.titleBar as ViewStyle }>
                    <TitleBar />
                </View>
                <ConferenceTimer textStyle = { styles.roomTimer } />
            </View>
            {
                isLandscape
                    ? (
                        <View
                            pointerEvents = 'box-none'
                            style = { styles.landscapeContainer as ViewStyle }>
                            <View
                                pointerEvents = 'box-none'
                                style = { styles.landscapeMicrophoneContainer as ViewStyle }>
                                <MicrophoneButton />
                            </View>
                            <View
                                pointerEvents = 'box-none'
                                style = { styles.landscapeFooter as ViewStyle }>
                                <CarModeFooter />
                            </View>
                        </View>
                    )
                    : (
                        <View
                            pointerEvents = 'box-none'
                            style = { styles.microphoneContainer as ViewStyle }>
                            <MicrophoneButton />
                        </View>
                    )
            }
        </JitsiScreen>
    );
};

export default withSafeAreaInsets(CarMode);
