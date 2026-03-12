import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { connect, useSelector } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import ColorSchemeRegistry from '../../../base/color-scheme/ColorSchemeRegistry';
import Platform from '../../../base/react/Platform.native';
import AudioDeviceToggleButton from '../../../mobile/audio-mode/components/AudioDeviceToggleButton';
import { iAmVisitor } from '../../../visitors/functions';
import { customButtonPressed } from '../../actions.native';
import { getVisibleNativeButtons, isToolboxVisible } from '../../functions.native';
import { useNativeToolboxButtons } from '../../hooks.native';
import { IToolboxNativeButton } from '../../types';

import styles from './styles';

/**
 * The type of {@link Toolbox}'s React {@code Component} props.
 */
interface IProps {

    /**
     * Whether we are in visitors mode.
     */
    _iAmVisitor: boolean;

    /**
     * Currently selected audio route type.
     */
    _selectedAudioRouteType?: string;

    /**
     * The color-schemed stylesheet of the feature.
     */
    _styles: any;

    /**
     * The indicator which determines whether the toolbox is visible.
     */
    _visible: boolean;

    /**
     * Redux store dispatch method.
     */
    dispatch: IStore['dispatch'];
}

/**
 * Implements the conference Toolbox on React Native.
 *
 * @param {Object} props - The props of the component.
 * @returns {React$Element}
 */
function Toolbox(props: IProps) {
    const {
        _iAmVisitor,
        _selectedAudioRouteType,
        _styles,
        _visible,
        dispatch
    } = props;

    if (!_visible) {
        return null;
    }

    const { clientWidth } = useSelector((state: IReduxState) => state['features/base/responsive-ui']);
    const { customToolbarButtons } = useSelector((state: IReduxState) => state['features/base/config']);
    const toolbarBackgroundColor = useSelector((state: IReduxState) => state['features/base/config'].toolbarConfig?.backgroundColor);
    const {
        mainToolbarButtonsThresholds,
        toolbarButtons
    } = useSelector((state: IReduxState) => state['features/toolbox']);

    const allButtons = useNativeToolboxButtons(customToolbarButtons);

    const { mainMenuButtons, overflowMenuButtons } = getVisibleNativeButtons({
        allButtons,
        clientWidth,
        iAmVisitor: _iAmVisitor,
        mainToolbarButtonsThresholds,
        toolbarButtons
    });

    const bottomEdge = Platform.OS === 'ios' && _visible;
    const { buttonStylesBorderless, hangupButtonStyles } = _styles;
    const style = { ...styles.toolbox };

    // Allow overriding the toolbox background color from config (configOverwrite/overwriteConfig).
    if (toolbarBackgroundColor) {
        style.backgroundColor = toolbarBackgroundColor as any;
    }

    // We have only hangup and raisehand button in _iAmVisitor mode
    if (_iAmVisitor) {
        style.justifyContent = 'center';
    }

    const allVisibleButtons = [ ...(mainMenuButtons || []), ...(overflowMenuButtons || []) ];
    const pick = (key: string) => allVisibleButtons.find(button => button.key === key);
    const orderedButtons = [
        pick('overflowmenu'),
        pick('camera'),
        {
            key: 'audioroute',
            Content: AudioDeviceToggleButton
        } as IToolboxNativeButton,
        pick('microphone'),
        pick('hangup')
    ].filter(Boolean) as IToolboxNativeButton[];

    const darkCircleStyles = {
        ...buttonStylesBorderless,
        style: {
            ...buttonStylesBorderless.style,
            backgroundColor: 'rgba(72, 72, 74, 0.85)',
            borderRadius: 24 
        }
    };
    const whiteCircleStyles = {
        ...buttonStylesBorderless,
        iconStyle: {
            ...buttonStylesBorderless.iconStyle,
            color: '#0B0B0C'
        },
        style: {
            ...buttonStylesBorderless.style,
            backgroundColor: '#ffff',
            borderRadius: 24 
        }
    };
    const audiorouteUsesWhiteBg
        = [ 'SPEAKER', 'BLUETOOTH', 'CAR' ].includes(_selectedAudioRouteType ?? '');

    const renderToolboxButtons = () => {
        if (!orderedButtons.length) {
            return;
        }

        return (
            <>
                {
                    orderedButtons.map(({ Content, key, text, ...rest }: IToolboxNativeButton) => (
                        <Content
                            { ...rest }
                            /* eslint-disable react/jsx-no-bind */
                            handleClick = { () => dispatch(customButtonPressed(key, text)) }
                            isToolboxButton = { true }
                            key = { key }
                            styles = {
                                key === 'hangup'
                                    ? hangupButtonStyles
                                    : key === 'audioroute'
                                        ? audiorouteUsesWhiteBg ? whiteCircleStyles : darkCircleStyles
                                        : key === 'camera'
                                            ? whiteCircleStyles
                                            : darkCircleStyles
                            } />
                    ))
                }
            </>
        );
    };

    return (
        <View
            style = { styles.toolboxContainer as ViewStyle }>
            <SafeAreaView
                accessibilityRole = 'toolbar'
                edges = { [ bottomEdge && 'bottom' ].filter(Boolean) as Edge[] }
                pointerEvents = 'box-none'
                style = { styles.toolboxSafeArea as ViewStyle }>
                <View style = { style as ViewStyle }>
                    { renderToolboxButtons() }
                </View>
            </SafeAreaView>
        </View>
    );
}

/**
 * Maps parts of the redux state to {@link Toolbox} (React {@code Component})
 * props.
 *
 * @param {Object} state - The redux state of which parts are to be mapped to
 * {@code Toolbox} props.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const selectedDevice = state['features/mobile/audio-mode'].devices.find(device => device.selected);

    return {
        _iAmVisitor: iAmVisitor(state),
        _selectedAudioRouteType: selectedDevice?.type,
        _styles: ColorSchemeRegistry.get(state, 'Toolbox'),
        _visible: isToolboxVisible(state),
    };
}

export default connect(_mapStateToProps)(Toolbox);
