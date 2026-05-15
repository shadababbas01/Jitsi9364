/* eslint-disable react/no-multi-comp */

import React, { PureComponent } from 'react';
import {
    NativeModules,
    Platform,
    Text,
    View,
    ViewStyle
} from 'react-native';
import { connect, useSelector } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import { hideSheet } from '../../../base/dialog/actions';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import { translate } from '../../../base/i18n/functions';
import { IconInfo, IconUsers } from '../../../base/icons/svg';
import { IParticipantsState } from '../../../base/participants/reducer';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import BreakoutRoomsButton
    from '../../../breakout-rooms/components/native/BreakoutRoomsButton';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import ReactionMenu from '../../../reactions/components/native/ReactionMenu';
import { shouldDisplayReactionsButtons } from '../../../reactions/functions.any';
import { areClosedCaptionsEnabled, isLiveCaptionsActive } from '../../../subtitles/functions.any';
import TileViewButton from '../../../video-layout/components/TileViewButton';
import { iAmVisitor } from '../../../visitors/functions';
import { customButtonPressed } from '../../actions.native';
import { getVisibleNativeButtons } from '../../functions.native';
import { useNativeToolboxButtons } from '../../hooks.native';
import { IToolboxNativeButton } from '../../types';

import AudioOnlyButton from './AudioOnlyButton';
import OpenCarmodeButton from './OpenCarmodeButton';
import RaiseHandButton from './RaiseHandButton';
import ScreenSharingButton from './ScreenSharingButton';
import ZoomButton from './ZoomButton';

const { NativeCallsNew, OpenMelpChat } = NativeModules;

interface IOverflowParticipantsButtonProps extends AbstractButtonProps {
    _participants: IParticipantsState;
}

class OverflowAttendeesButton extends AbstractButton<IOverflowParticipantsButtonProps> {
    override accessibilityLabel = 'toolbar.participants';
    override icon = IconUsers;
    override label = 'toolbar.participants';

    override _handleClick() {
        const { _participants } = this.props;
        const attendees: Array<string> = [];

        if (_participants?.local?.email) {
            attendees.push(_participants.local.email);
        }

        _participants?.remote?.forEach(participant => {
            if (participant?.email) {
                attendees.push(participant.email);
            }
        });

        if (OpenMelpChat?.showAttendees) {
            OpenMelpChat.showAttendees(attendees);

            return;
        }

        if (NativeCallsNew?.showAttendees) {
            NativeCallsNew.showAttendees(attendees);

            return;
        }

        NativeCallsNew?.showAttendeeeees?.();
    }
}

interface ILiveCaptionsOverflowButtonProps extends AbstractButtonProps {
    _isLiveCaptionsActive: boolean;
}

const liveCaptionsActiveStyles = {
    rowStatus: {
        alignItems: 'center' as const,
        flexDirection: 'row' as const,
        marginLeft: 'auto' as const
    },
    statusDot: {
        backgroundColor: '#7CE39B',
        borderRadius: 999,
        height: 8,
        marginRight: 8,
        width: 8
    },
    statusText: {
        color: '#7CE39B',
        fontSize: 12
    }
};

class LiveCaptionsOverflowButton extends AbstractButton<ILiveCaptionsOverflowButtonProps> {
    override accessibilityLabel = 'liveCaptionsPanel.title';
    override icon = IconInfo;
    override label = 'liveCaptionsPanel.title';

    override _handleClick() {
        navigate(screen.conference.liveCaptions);
    }

    override _getElementAfter() {
        if (!this.props._isLiveCaptionsActive) {
            return null;
        }

        return (
            <View style = { liveCaptionsActiveStyles.rowStatus }>
                <View style = { liveCaptionsActiveStyles.statusDot } />
                <Text style = { liveCaptionsActiveStyles.statusText }>
                    Live
                </Text>
            </View>
        );
    }

    override _isToggled() {
        return this.props._isLiveCaptionsActive;
    }
}

const TranslatedOverflowAttendeesButton = translate(OverflowAttendeesButton);
const TranslatedLiveCaptionsOverflowButton = translate(connect((state: IReduxState) => ({
    _isLiveCaptionsActive: isLiveCaptionsActive(state)
}))(LiveCaptionsOverflowButton));

// iOS 26 Liquid Glass — list row style
// Icon left, label right, hairline dividers, floating frosted card

const listRowButtonStyles = {
    iconStyle: {
        color: '#FFFFFF',
        fontSize: 22
    },
    labelStyle: {
        color: '#FFFFFF',
        flex: 1,
        fontSize: 17,
        fontWeight: '400' as const,
        marginLeft: 14
    },
    style: {
        alignItems: 'center' as const,
        backgroundColor: 'transparent',
        flexDirection: 'row' as const,
        height: 56,
        paddingHorizontal: 20
    },
    underlayColor: 'rgba(255,255,255,0.10)'
};

const overflowSheetStyle: ViewStyle = {
    backgroundColor: 'rgba(30, 30, 32, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 0.5,
    overflow: 'hidden',
    paddingBottom: 0,
    paddingTop: 0,
    ...(Platform.select({
        android: {
            elevation: 32
        },
        ios: {
            marginBottom: 10,
            marginHorizontal: 10,
            shadowColor: '#000000',
            shadowOffset: { height: 0, width: 0 },
            shadowOpacity: 0.55,
            shadowRadius: 28
        }
    }) as ViewStyle)
};

const overflowSheetHeaderStyles = {
    grabber: {
        alignSelf: 'center' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 99,
        height: 4,
        marginBottom: 6,
        marginTop: 10,
        width: 36
    },
    wrapper: {
        alignItems: 'center' as const,
        paddingBottom: 4,
        paddingTop: 0
    },
    title: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 13,
        fontWeight: '500' as const,
        letterSpacing: 0.1,
        paddingBottom: 4
    }
};

const overflowMenuStyles = {
    list: {
        paddingBottom: 4,
        paddingTop: 0
    },
    divider: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        height: 0.5,
        marginLeft: 56
    }
};


/**
 * The type of the React {@code Component} props of {@link OverflowMenu}.
 */
interface IProps {

    /**
     * True if breakout rooms feature is available, false otherwise.
     */
    _isBreakoutRoomsSupported?: boolean;

    /**
     * True if live captions are enabled by config.
     */
    _isClosedCaptionsEnabled: boolean;

    /**
     * Toolbar buttons.
     */
    _mainMenuButtons?: Array<IToolboxNativeButton>;

    /**
     * Overflow menu buttons.
     */
    _overflowMenuButtons?: Array<IToolboxNativeButton>;

    /**
     * Participants state for attendee list payloads.
     */
    _participants: IParticipantsState;

    /**
    * Whether or not any reactions buttons should be displayed.
    */
    _shouldDisplayReactionsButtons: boolean;

    /**
     * Used for hiding the dialog when the selection was completed.
     */
    dispatch: IStore['dispatch'];
}

interface IState {

    /**
     * True if the bottom sheet is scrolled to the top.
     */
    scrolledToTop: boolean;
}

/**
 * Implements a React {@code Component} with some extra actions in addition to
 * those in the toolbar.
 */
class OverflowMenu extends PureComponent<IProps, IState> {
    /**
     * Initializes a new {@code OverflowMenu} instance.
     *
     * @inheritdoc
     */
    constructor(props: IProps) {
        super(props);

        this.state = {
            scrolledToTop: true
        };

        // Bind event handlers so they are only bound once per instance.
        this._onCancel = this._onCancel.bind(this);
        this._renderReactionMenu = this._renderReactionMenu.bind(this);
        this._renderHeader = this._renderHeader.bind(this);
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        const {
            _isBreakoutRoomsSupported,
            _isClosedCaptionsEnabled,
            dispatch
        } = this.props;

        const rowProps = {
            afterClick: this._onCancel,
            showLabel: true,
            styles: listRowButtonStyles
        };
        const topRowProps = {
            afterClick: this._onCancel,
            dispatch,
            showLabel: true,
            styles: listRowButtonStyles,
            _participants: this.props._participants
        };
        const D = () => <View style = { overflowMenuStyles.divider as ViewStyle } />;

        return (
            <BottomSheet
                renderFooter = { this._renderReactionMenu }
                renderHeader = { this._renderHeader }
                style = { overflowSheetStyle }>
                <View style = { overflowMenuStyles.list as ViewStyle }>
                    <OpenCarmodeButton { ...topRowProps } />
                    {_isClosedCaptionsEnabled && <><D /><TranslatedLiveCaptionsOverflowButton { ...topRowProps } /></>}
                    <D />
                    <AudioOnlyButton { ...rowProps } />
                    { this._renderRaiseHandButton(rowProps) }
                    {_isBreakoutRoomsSupported && <><D /><BreakoutRoomsButton { ...rowProps } /></>}
                    <D />
                    {(Boolean(OpenMelpChat?.showAttendees) || Boolean(NativeCallsNew?.showAttendees) || Boolean(NativeCallsNew?.showAttendeeeees))
                        && <><D /><TranslatedOverflowAttendeesButton { ...topRowProps } /></>}
                    <D />
                    <ScreenSharingButton { ...rowProps } />
                    <TileViewButton { ...rowProps } />
                    <D />
                    <ZoomButton { ...rowProps } />
                    <D />
                    { this._renderOverflowMenuButtons(topRowProps, [ 'chat', 'desktop', 'tileview', 'raisehand', 'polls' ]) }
                    <D />
                </View>
            </BottomSheet>
        );
    }

    /**
     * Hides this {@code OverflowMenu}.
     *
     * @private
     * @returns {void}
     */
    _onCancel() {
        this.props.dispatch(hideSheet());
    }

    /**
     * Function to render the reaction menu as the footer of the bottom sheet.
     *
     * @returns {React.ReactElement}
     */
    _renderReactionMenu() {
        const { _mainMenuButtons, _shouldDisplayReactionsButtons } = this.props;

        // @ts-ignore
        const isRaiseHandInMainMenu = _mainMenuButtons?.some(item => item.key === 'raisehand');

        if (_shouldDisplayReactionsButtons && !isRaiseHandInMainMenu) {
            return (
                <ReactionMenu
                    onCancel = { this._onCancel }
                    overflowMenu = { true } />
            );
        }
    }

    _renderHeader() {
        return (
            <View style = { overflowSheetHeaderStyles.wrapper as ViewStyle }>
                <View style = { overflowSheetHeaderStyles.grabber as ViewStyle } />
                <Text style = { overflowSheetHeaderStyles.title }>
                    More Options
                </Text>
            </View>
        );
    }

    /**
     * Function to render the reaction menu as the footer of the bottom sheet.
     *
     * @param {Object} buttonProps - Styling button properties.
     * @returns {React.ReactElement}
     */
    _renderRaiseHandButton(buttonProps: Object) {
        const { _mainMenuButtons, _shouldDisplayReactionsButtons } = this.props;

        // @ts-ignore
        const isRaiseHandInMainMenu = _mainMenuButtons?.some(item => item.key === 'raisehand');

        if (!_shouldDisplayReactionsButtons && !isRaiseHandInMainMenu) {
            return (
                <RaiseHandButton { ...buttonProps } />
            );
        }
    }

    /**
     * Function to render the custom buttons for the overflow menu.
     *
     * @param {Object} topButtonProps - Styling button properties.
     * @param {string[]} excludedKeys - Button keys to skip in this render pass.
     * @returns {React.ReactElement}
     */
    _renderOverflowMenuButtons(topButtonProps: Object, excludedKeys: string[] = [ 'raisehand' ]) {
        const { _overflowMenuButtons, dispatch } = this.props;

        if (!_overflowMenuButtons?.length) {
            return;
        }

        return (
            <>
                {
                    _overflowMenuButtons?.map(({ Content, key, text, ...rest }: IToolboxNativeButton) => {

                        if (excludedKeys.includes(key)) {
                            return null;
                        }

                        return (
                            <Content
                                { ...topButtonProps }
                                { ...rest }
                                /* eslint-disable react/jsx-no-bind */
                                handleClick = { () => dispatch(customButtonPressed(key, text)) }
                                isToolboxButton = { false }
                                key = { key }
                                text = { text } />
                        );
                    })
                }
            </>
        );
    }
}

/**
 * Function that maps parts of Redux state tree into component props.
 *
 * @param {Object} state - Redux state.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState) {
    const { conference } = state['features/base/conference'];

    return {
        _isBreakoutRoomsSupported: conference?.getBreakoutRooms()?.isSupported(),
        _isClosedCaptionsEnabled: areClosedCaptionsEnabled(state),
        _shouldDisplayReactionsButtons: shouldDisplayReactionsButtons(state),
        _participants: state['features/base/participants']
    };
}

export default connect(_mapStateToProps)(props => {
    const { clientWidth } = useSelector((state: IReduxState) => state['features/base/responsive-ui']);
    const { customToolbarButtons } = useSelector((state: IReduxState) => state['features/base/config']);
    const {
        mainToolbarButtonsThresholds,
        toolbarButtons
    } = useSelector((state: IReduxState) => state['features/toolbox']);
    const _iAmVisitor = useSelector(iAmVisitor);

    const allButtons = useNativeToolboxButtons(customToolbarButtons);

    const { mainMenuButtons, overflowMenuButtons } = getVisibleNativeButtons({
        allButtons,
        clientWidth,
        mainToolbarButtonsThresholds,
        toolbarButtons,
        iAmVisitor: _iAmVisitor
    });

    return (
        <OverflowMenu

            // @ts-ignore
            { ... props }
            _mainMenuButtons = { mainMenuButtons }
            _overflowMenuButtons = { overflowMenuButtons } />
    );
});
