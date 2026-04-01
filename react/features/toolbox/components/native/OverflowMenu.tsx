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
import { hideSheet, openSheet } from '../../../base/dialog/actions';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import { translate } from '../../../base/i18n/functions';
import { IconImage, IconInfo, IconUsers } from '../../../base/icons/svg';
import { IParticipantsState } from '../../../base/participants/reducer';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import BreakoutRoomsButton
    from '../../../breakout-rooms/components/native/BreakoutRoomsButton';
import ChatButton from '../../../chat/components/native/ChatButton';
import { openPollsPanel } from '../../../chat/actions.any';
import SharedDocumentButton from '../../../etherpad/components/SharedDocumentButton.native';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import ReactionMenu from '../../../reactions/components/native/ReactionMenu';
import { shouldDisplayReactionsButtons } from '../../../reactions/functions.any';
import LiveStreamButton from '../../../recording/components/LiveStream/native/LiveStreamButton';
import RecordButton from '../../../recording/components/Recording/native/RecordButton';
import SharedVideoButton from '../../../shared-video/components/native/SharedVideoButton';
import { isSharedVideoEnabled } from '../../../shared-video/functions';
import { isSpeakerStatsDisabled } from '../../../speaker-stats/functions';
import TileViewButton from '../../../video-layout/components/TileViewButton';
// import VirtualBackgroundMenu from '../../../virtual-background/components/VirtualBackgroundMenu.native';
// import { checkBlurSupport, checkVirtualBackgroundEnabled } from '../../../virtual-background/functions.native';
import { iAmVisitor } from '../../../visitors/functions';
import WhiteboardButton from '../../../whiteboard/components/native/WhiteboardButton';
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

class OverflowPollsButton extends AbstractButton<AbstractButtonProps> {
    override accessibilityLabel = 'chat.tabs.polls';
    override icon = IconInfo;
    override label = 'chat.tabs.polls';

    override _handleClick() {
        const { dispatch } = this.props;

        dispatch(openPollsPanel());
        navigate(screen.conference.chatTabs.main, {
            screen: screen.conference.chatTabs.tab.polls
        });
    }
}

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

interface IOverflowVirtualBackgroundButtonProps extends AbstractButtonProps {
    _isBackgroundEnabled: boolean;
}

class OverflowVirtualBackgroundButton extends AbstractButton<IOverflowVirtualBackgroundButtonProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.selectBackground';
    override icon = IconImage;
    override label = 'toolbar.selectBackground';

    // override _handleClick() {
    //     this.props.dispatch(openSheet(VirtualBackgroundMenu));
    // }

    override _isToggled() {
        return this.props._isBackgroundEnabled;
    }
}

const TranslatedOverflowPollsButton = translate(OverflowPollsButton);
const TranslatedOverflowAttendeesButton = translate(OverflowAttendeesButton);
const TranslatedOverflowVirtualBackgroundButton = translate(OverflowVirtualBackgroundButton);

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
     * Whether the conference is currently in audio-only mode.
     */
    _isAudioOnly: boolean;

    /**
     * True if virtual background effect is currently active.
     */
    _isBackgroundEnabled: boolean;

    /**
     * True if breakout rooms feature is available, false otherwise.
     */
    _isBreakoutRoomsSupported?: boolean;

    /**
     * True if the overflow menu is currently visible, false otherwise.
     */
    _isOpen: boolean;

    /**
     * Whether the shared video is enabled or not.
     */
    _isSharedVideoEnabled: boolean;

    /**
     * Whether or not speaker stats is disable.
     */
    _isSpeakerStatsDisabled?: boolean;

    /**
     * Toolbar buttons.
     */
    _mainMenuButtons?: Array<IToolboxNativeButton>;

    /**
     * Overflow menu buttons.
     */
    _overflowMenuButtons?: Array<IToolboxNativeButton>;

    /**
     * Whether the recoding button should be enabled or not.
    */
    _recordingEnabled: boolean;

    /**
     * Participants state for attendee list payloads.
     */
    _participants: IParticipantsState;

    /**
    * Whether or not any reactions buttons should be displayed.
    */
    _shouldDisplayReactionsButtons: boolean;

    /**
    * Whether polls button should be shown.
    */
    _showPolls: boolean;

    /**
     * Whether virtual background button should be shown.
     */
    // _showVirtualBackground: boolean;

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
            _isAudioOnly,
            _isBackgroundEnabled,
            _isBreakoutRoomsSupported,
            _isSharedVideoEnabled,
            _showPolls,
            // _showVirtualBackground,
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
        const videoBackgroundRowProps = {
            ...topRowProps,
            afterClick: undefined
        };
        const D = () => <View style = { overflowMenuStyles.divider as ViewStyle } />;

        return (
            <BottomSheet
                renderFooter = { this._renderReactionMenu }
                renderHeader = { this._renderHeader }
                style = { overflowSheetStyle }>
                <View style = { overflowMenuStyles.list as ViewStyle }>
                    <OpenCarmodeButton { ...topRowProps } />
                    <D />
                    <AudioOnlyButton { ...rowProps } />
                    { this._renderRaiseHandButton(rowProps) }
                    {_isBreakoutRoomsSupported && <><D /><BreakoutRoomsButton { ...rowProps } /></>}
                    <D />
                    {/* <RecordButton { ...rowProps } /> */}
                    {/* {!_isAudioOnly && <><D /><LiveStreamButton { ...rowProps } /></>} */}
                    {/* <WhiteboardButton { ...rowProps } /> */}
                    {(Boolean(OpenMelpChat?.showAttendees) || Boolean(NativeCallsNew?.showAttendees) || Boolean(NativeCallsNew?.showAttendeeeees))
                        && <><D /><TranslatedOverflowAttendeesButton { ...topRowProps } /></>}
                    {/* {!_isAudioOnly && _isSharedVideoEnabled && <><D /><SharedVideoButton { ...rowProps } /></>} */}
                    {/* { _showPolls && <><D /><TranslatedOverflowPollsButton { ...topRowProps } /></> } */}
                    {/* {_showVirtualBackground && (
                        <>
                            <D />
                            <TranslatedOverflowVirtualBackgroundButton
                                { ...videoBackgroundRowProps }
                                _isBackgroundEnabled = { _isBackgroundEnabled } />
                        </>
                    )} */}
                    <D />
                    <ScreenSharingButton { ...rowProps } />
                    <TileViewButton { ...rowProps } />
                    <D />
                    <ZoomButton { ...rowProps } />
                    <D />
                    <SharedDocumentButton { ...rowProps } />
                    { this._renderOverflowMenuButtons(topRowProps, [ 'desktop', 'tileview', 'raisehand', 'polls' ]) }
                    <D />
                    {/* <ChatButton { ...rowProps } /> */}
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
    const { enabled: audioOnly } = state['features/base/audio-only'];

    return {
        _isAudioOnly: Boolean(audioOnly),
        _isBackgroundEnabled: Boolean(state['features/virtual-background']?.backgroundEffectEnabled),
        _isBreakoutRoomsSupported: conference?.getBreakoutRooms()?.isSupported(),
        _isSharedVideoEnabled: isSharedVideoEnabled(state),
        _isSpeakerStatsDisabled: isSpeakerStatsDisabled(state),
        _showPolls: !Boolean(state['features/base/config']?.disablePolls) && !iAmVisitor(state),
        _shouldDisplayReactionsButtons: shouldDisplayReactionsButtons(state),
        _participants: state['features/base/participants']
        // _showVirtualBackground: checkBlurSupport() && checkVirtualBackgroundEnabled(state)
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
