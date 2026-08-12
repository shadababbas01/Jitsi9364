import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Image,
    ImageStyle,
    ScrollView,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconCheck, IconCloseLarge, IconPlus, IconUser } from '../../../base/icons/svg';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import {
    applyVirtualBackground,
    deleteVirtualBackgroundImage,
    importVirtualBackgroundImage,
    selectVirtualBackground
} from '../actions';
import { VIRTUAL_BACKGROUND_TYPE } from '../constants';
import {
    getVirtualBackgroundImages,
    getVirtualBackgroundState,
    isVirtualBackgroundSupported
} from '../functions';

import styles from './styles';

/**
 * Lets the local participant pick what is composited behind them: nothing, a blur, one of the
 * backgrounds bundled with the app, or a picture from the device gallery.
 *
 * @returns {JSX.Element}
 */
const VirtualBackgroundScreen = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const supported = useSelector(isVirtualBackgroundSupported);
    const { backgroundType, uri: selectedUri } = useSelector(getVirtualBackgroundState);
    const images = useSelector((state: IReduxState) => getVirtualBackgroundImages(state));

    const onSelectNone = useCallback(() => {
        dispatch(selectVirtualBackground(VIRTUAL_BACKGROUND_TYPE.NONE));
    }, [ dispatch ]);

    const onSelectBlur = useCallback(() => {
        dispatch(selectVirtualBackground(VIRTUAL_BACKGROUND_TYPE.BLUR));
    }, [ dispatch ]);

    const onImport = useCallback(() => {
        dispatch(importVirtualBackgroundImage());
    }, [ dispatch ]);

    const onSelectImage = useCallback((imageUri: string) => {
        if (backgroundType === VIRTUAL_BACKGROUND_TYPE.IMAGE && selectedUri === imageUri) {
            // Tapping the background which is already in use re-applies it, which is a cheap way
            // out of the (rare) case where the camera was restarted while the picker was open.
            dispatch(applyVirtualBackground());

            return;
        }

        dispatch(selectVirtualBackground(VIRTUAL_BACKGROUND_TYPE.IMAGE, imageUri));
    }, [ backgroundType, dispatch, selectedUri ]);

    const onDeleteImage = useCallback((imageUri: string) => {
        Alert.alert(
            t('virtualBackground.deleteImage'),
            undefined,
            [
                { style: 'cancel', text: t('dialog.Cancel') },
                {
                    onPress: () => dispatch(deleteVirtualBackgroundImage(imageUri)),
                    style: 'destructive',
                    text: t('dialog.Remove')
                }
            ]);
    }, [ dispatch, t ]);

    if (!supported) {
        return (
            <JitsiScreen style = { styles.container }>
                <Text style = { styles.unsupported as TextStyle }>
                    { t('virtualBackground.unsupported') }
                </Text>
            </JitsiScreen>
        );
    }

    /**
     * Renders a tile which has no image of its own.
     *
     * @param {Object} options - The tile description.
     * @returns {JSX.Element}
     */
    const renderPlaceholderTile = ({ accessibilityLabel, icon, label, onPress, selected }: {
        accessibilityLabel: string;
        icon: Function;
        label: string;
        onPress: () => void;
        selected: boolean;
    }) => (
        <View style = { styles.tileWrapper as ViewStyle }>
            <TouchableOpacity
                accessibilityLabel = { accessibilityLabel }
                accessibilityRole = 'button'
                onPress = { onPress }
                style = { [ styles.tile, selected && styles.tileSelected ] as ViewStyle[] }>
                <View style = { styles.tilePlaceholder as ViewStyle }>
                    <Icon
                        color = { BaseTheme.palette.icon01 }
                        size = { 24 }
                        src = { icon } />
                    <Text
                        numberOfLines = { 2 }
                        style = { styles.tileLabel as TextStyle }>
                        { label }
                    </Text>
                </View>
                { selected && (
                    <View style = { styles.tileCheck as ViewStyle }>
                        <Icon
                            color = { BaseTheme.palette.icon04 }
                            size = { 14 }
                            src = { IconCheck } />
                    </View>
                ) }
            </TouchableOpacity>
        </View>
    );

    return (
        <JitsiScreen style = { styles.container }>
            <ScrollView>
                <Text style = { styles.sectionLabel as TextStyle }>
                    { t('virtualBackground.pickBackground') }
                </Text>
                <View style = { styles.grid as ViewStyle }>
                    { renderPlaceholderTile({
                        accessibilityLabel: t('virtualBackground.none'),
                        icon: IconCloseLarge,
                        label: t('virtualBackground.none'),
                        onPress: onSelectNone,
                        selected: backgroundType === VIRTUAL_BACKGROUND_TYPE.NONE
                    }) }
                    { renderPlaceholderTile({
                        accessibilityLabel: t('virtualBackground.blur'),
                        icon: IconUser,
                        label: t('virtualBackground.blur'),
                        onPress: onSelectBlur,
                        selected: backgroundType === VIRTUAL_BACKGROUND_TYPE.BLUR
                    }) }
                    { renderPlaceholderTile({
                        accessibilityLabel: t('virtualBackground.addBackground'),
                        icon: IconPlus,
                        label: t('virtualBackground.addBackground'),
                        onPress: onImport,
                        selected: false
                    }) }
                    { images.map(image => {
                        const selected = backgroundType === VIRTUAL_BACKGROUND_TYPE.IMAGE
                            && selectedUri === image.uri;

                        return (
                            <View
                                key = { image.id }
                                style = { styles.tileWrapper as ViewStyle }>
                                <TouchableOpacity
                                    accessibilityLabel = { t('virtualBackground.image') }
                                    accessibilityRole = 'button'

                                    /* eslint-disable-next-line react/jsx-no-bind */
                                    onPress = { () => onSelectImage(image.uri) }
                                    style = { [ styles.tile, selected && styles.tileSelected ] as ViewStyle[] }>
                                    <Image
                                        resizeMode = 'cover'
                                        source = {{ uri: image.uri }}
                                        style = { styles.tileImage as ImageStyle } />
                                    { selected && (
                                        <View style = { styles.tileCheck as ViewStyle }>
                                            <Icon
                                                color = { BaseTheme.palette.icon04 }
                                                size = { 14 }
                                                src = { IconCheck } />
                                        </View>
                                    ) }
                                    { image.stored && (
                                        <TouchableOpacity
                                            accessibilityLabel = { t('virtualBackground.deleteImage') }
                                            accessibilityRole = 'button'

                                            /* eslint-disable-next-line react/jsx-no-bind */
                                            onPress = { () => onDeleteImage(image.uri) }
                                            style = { styles.tileDelete as ViewStyle }>
                                            <Icon
                                                color = { BaseTheme.palette.icon01 }
                                                size = { 14 }
                                                src = { IconCloseLarge } />
                                        </TouchableOpacity>
                                    ) }
                                </TouchableOpacity>
                            </View>
                        );
                    }) }
                </View>
            </ScrollView>
        </JitsiScreen>
    );
};

export default VirtualBackgroundScreen;
