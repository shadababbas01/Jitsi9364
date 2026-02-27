import React from 'react';
import { View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect, useSelector } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import ColorSchemeRegistry from '../../../base/color-scheme/ColorSchemeRegistry';
import Platform from '../../../base/react/Platform.native';
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
    ismessage: boolean;

    /**
     * The color-schemed stylesheet of the feature.
     */
    _styles: any;
    setMessagestate: (state: boolean) => void;

    /**
     * The indicator which determines whether the toolbox is visible.
     */
    _visible: boolean;

    /**
     * Redux store dispatch method.
     */
    _width: number;
    newMessage: any;
}

/**
 * Implements the conference Toolbox on React Native.
 *
 * @param {Object} props - The props of the component.
 * @returns {React$Element}
 */
function Toolbox(props: IProps) {
    const { _endConferenceSupported, _shouldDisplayReactionsButtons, _styles, _visible, _iAmVisitor, _width, newMessage,setMessagestate, ismessage } = props;

    if (!_visible) {
        return null;
    }

    const { clientWidth } = useSelector((state: IReduxState) => state['features/base/responsive-ui']);
    const { customToolbarButtons } = useSelector((state: IReduxState) => state['features/base/config']);
    const {
        mainToolbarButtonsThresholds,
        toolbarButtons
    } = useSelector((state: IReduxState) => state['features/toolbox']);

    const allButtons = useNativeToolboxButtons(customToolbarButtons);

    const { mainMenuButtons } = getVisibleNativeButtons({
        allButtons,
        clientWidth,
        iAmVisitor: _iAmVisitor,
        mainToolbarButtonsThresholds,
        toolbarButtons
    });

    const bottomEdge = Platform.OS === 'ios' && _visible;
    const { buttonStylesBorderless, hangupButtonStyles, toggledButtonStyles, toggledButtonStyles2 } = _styles;
    const additionalButtons = getMovableButtons(_width);
    const backgroundToggledStyle = {
        ...toggledButtonStyles,
        style: [
            toggledButtonStyles.style,
            _styles.backgroundToggle
        ]
    };
    const style = { ...styles.toolbox };

    // We have only hangup and raisehand button in _iAmVisitor mode
    if (_iAmVisitor) {
        
        style.justifyContent = 'center';
    }
    additionalButtons.add('raisehand');
    console.log('this is new message in toolbox', newMessage);

    const renderToolboxButtons = () => {
        if (!mainMenuButtons?.length) {
            return;
        }

        return (
            <>
                {
                    mainMenuButtons?.map(({ Content, key, text, ...rest }: IToolboxNativeButton) => (
                        <Content
                            { ...rest }
                            /* eslint-disable react/jsx-no-bind */
                            handleClick = { () => dispatch(customButtonPressed(key, text)) }
                            isToolboxButton = { true }
                            key = { key }
                            styles = { key === 'hangup' ? hangupButtonStyles : buttonStylesBorderless } />
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

                // @ts-ignore
                edges = { [ bottomEdge && 'bottom' ].filter(Boolean) }
                pointerEvents = 'box-none'
                style = { style as ViewStyle }>
                    {additionalButtons.has('chat')
                      && <ChatButton setMessagestate={setMessagestate} ismessage={ismessage}
                          styles = { buttonStylesBorderless } />
                        }
                        {!_iAmVisitor && <AudioMuteButton
                    styles = { buttonStylesBorderless }
                    toggledStyles = { toggledButtonStyles } />
                }
                        {/* added by jaswant { false &&_endConferenceSupported
                    ? <HangupMenuButton
                        styles = { hangupMenuButtonStyles }
                        toggledStyles = { toggledButtonStyles } />
                    : <HangupButton
                        styles = { hangupButtonStyles } />
                } */
                // <HangupButton
                    // styles = { hangupButtonStyles } />
                <HangupMenuButton
                styles = { hangupButtonStyles }
                toggledStyles = { toggledButtonStyles } />
                }
                
                {!_iAmVisitor && <VideoMuteButton
                    styles = { buttonStylesBorderless }
                    // toggledStyles = { toggledButtonStyles } 
                    />
                }
                {/* {additionalButtons.has('chat')
                    && <ChatButton
                        styles = { buttonStylesBorderless }
                        toggledStyles = { backgroundToggledStyle } />
                } */}
                { additionalButtons.has('raisehand') && <RaiseHandButton styles = { buttonStylesBorderless }
                toggledStyles = { toggledButtonStyles2 }/>}
                {!_iAmVisitor && additionalButtons.has('screensharing')
                    && <ScreenSharingButton styles = { buttonStylesBorderless } />}
                {/*additionalButtons.has('raisehand') && (_shouldDisplayReactionsButtons
                    ? <ReactionsMenuButton
                        styles = { buttonStylesBoPrderless }
                        toggledStyles = { backgroundToggledStyle } />
                    : <RaiseHandButton
                        styles = { buttonStylesBorderless }
                toggledStyles = { backgroundToggledStyle } />)*/}
                {additionalButtons.has('tileview') && <TileViewButton styles = { buttonStylesBorderless } />}
                {!_iAmVisitor && <OverflowMenuButton
                    styles = { buttonStylesBorderless }
                    toggledStyles = { toggledButtonStyles } />
                }
                
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
    return {
        _iAmVisitor: iAmVisitor(state),
        _styles: ColorSchemeRegistry.get(state, 'Toolbox'),
        _visible: isToolboxVisible(state),
    };
}

export default connect(_mapStateToProps)(Toolbox);
