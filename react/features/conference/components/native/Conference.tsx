import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef } from 'react';
import {
    Animated,
    BackHandler,
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform,
    Text,
    View,
    ViewStyle
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { Edge, EdgeInsets, SafeAreaView, withSafeAreaInsets } from 'react-native-safe-area-context';
import { connect, useDispatch, useSelector } from 'react-redux';

import { appNavigate } from '../../../app/actions.native';
import { IReduxState, IStore } from '../../../app/types';
import Avatar from '../../../base/avatar/components/Avatar';
import { CONFERENCE_BLURRED, CONFERENCE_FOCUSED } from '../../../base/conference/actionTypes';
import { setConnectionStatus } from '../../../base/conference/actions.any';
import { MEDIA_TYPE } from '../../../base/media/constants';
import {
    getLocalParticipant,
    getParticipantById,
    getRemoteParticipants,
    isScreenShareParticipant
} from '../../../base/participants/functions';
import Container from '../../../base/react/components/native/Container';
import LoadingIndicator from '../../../base/react/components/native/LoadingIndicator';
import TintedView from '../../../base/react/components/native/TintedView';
import {
    ASPECT_RATIO_NARROW,
    ASPECT_RATIO_WIDE
} from '../../../base/responsive-ui/constants';
import { updateSettings } from '../../../base/settings/actions';
import { getHideSelfView } from '../../../base/settings/functions.any';
import { StyleType } from '../../../base/styles/functions.any';
import TestConnectionInfo from '../../../base/testing/components/TestConnectionInfo';
import { getTrackByMediaTypeAndParticipant } from '../../../base/tracks/functions.native';
import { isCalendarEnabled } from '../../../calendar-sync/functions.native';
import BrandingImageBackground from '../../../dynamic-branding/components/native/BrandingImageBackground';
import Filmstrip from '../../../filmstrip/components/native/Filmstrip';
import FloatingLocalThumbnail from '../../../filmstrip/components/native/FloatingLocalThumbnail';
import TileView from '../../../filmstrip/components/native/TileView';
import { FILMSTRIP_SIZE } from '../../../filmstrip/constants';
import { isFilmstripVisible } from '../../../filmstrip/functions.native';
import { setCalleeInfoVisible } from '../../../invite/actions.any';
import CalleeInfoContainer from '../../../invite/components/callee-info/CalleeInfoContainer';
import LargeVideo from '../../../large-video/components/LargeVideo.native';
import { getIsLobbyVisible } from '../../../lobby/functions';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { isPipEnabled, setPictureInPictureEnabled } from '../../../mobile/picture-in-picture/functions';
import Captions from '../../../subtitles/components/native/Captions';
import { setToolboxVisible } from '../../../toolbox/actions.native';
import Toolbox from '../../../toolbox/components/native/Toolbox';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { setTileView } from '../../../video-layout/actions.any';
import {
    AbstractConference,
    type AbstractProps,
    abstractMapStateToProps
} from '../AbstractConference';
import { isConnecting } from '../functions.native';

import AlwaysOnLabels from './AlwaysOnLabels';
import ExpandedLabelPopup from './ExpandedLabelPopup';
import LonelyMeetingExperience from './LonelyMeetingExperience';
import SideToolbar from './SideToolbar';
import TitleBar from './TitleBar';
import { EXPANDED_LABEL_TIMEOUT } from './constants';
import styles from './styles';

const { JSCommunicateComponent, OpenMelpModule } = NativeModules;
const DOUBLE_PRESS_DELAY = 300;

// Full-width absolutely-positioned row that centres the pill
const remoteMutedBannerRow: ViewStyle = {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0
};

// The actual pill — sized to its content
const remoteMutedBannerPill: ViewStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 0.5,
    paddingHorizontal: 18,
    paddingVertical: 7
};

const remoteMutedTextStyle = {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500' as const
};

/**
 * WhatsApp-style "Muted" pill that appears at the bottom-center of the large
 * video when the remote participant has their mic off.
 *
 * @returns {ReactElement | null}
 */
function RemoteMutedBanner({ participantId, topOffset = 120 }: { participantId: string; topOffset?: number; }) {
    const tracks = useSelector((state: IReduxState) => state['features/base/tracks']);
    const participant = useSelector((state: IReduxState) => getParticipantById(state, participantId));
    const audioTrack = getTrackByMediaTypeAndParticipant(tracks, MEDIA_TYPE.AUDIO, participantId);
    const isMuted: boolean = audioTrack?.muted ?? false;
    const isRemote = Boolean(participant && !participant.local);
    const displayName: string = participant?.name ?? 'User';

    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: (isMuted && isRemote) ? 1 : 0,
            duration: 300,
            useNativeDriver: true
        }).start();
    }, [ isMuted, isRemote, opacity ]);

    if (!isRemote) {
        return null;
    }

    return (
        <Animated.View
            pointerEvents = 'none'
            style = { [ remoteMutedBannerRow, { opacity, top: topOffset } ] }>
            <View style = { remoteMutedBannerPill }>
                <Text style = { remoteMutedTextStyle }>
                    { `${displayName} is mute` }
                </Text>
            </View>
        </Animated.View>
    );
}

/**
 * The type of the React {@code Component} props of {@link Conference}.
 */
interface IProps extends AbstractProps {

    /**
     * Application's aspect ratio.
     */
    _aspectRatio: Symbol;

    /**
     * Whether the audio only is enabled or not.
     */
    _audioOnlyEnabled: boolean;

    /**
     * Branding styles for conference.
     */
    _brandingStyles: StyleType;

    /**
     * Whether the calendar feature is enabled or not.
     */
    _calendarEnabled: boolean;

    /**
     * Whether the callee overlay is currently visible.
     */
    _calleeInfoVisible: boolean;

    /**
     * Whether the car mode is active or not.
     */
    _carMode: boolean;

    /**
     * The indicator which determines that we are still connecting to the
     * conference which includes establishing the XMPP connection and then
     * joining the room. If truthy, then an activity/loading indicator will be
     * rendered.
     */
    _connecting: boolean;

    /**
     * Whether the local self-view should be hidden.
     */
    _disableSelfView: boolean;

    /**
     * Set to {@code true} when the filmstrip is currently visible.
     */
    _filmstripVisible: boolean;

    /**
     * Whether a non-screenshare remote participant has joined.
     */
    _hasConnectedRemoteParticipant: boolean;

    /**
     * Whether the Melp chat panel is currently open.
     */
    _isMelpChatOpen: boolean;

    /**
     * The indicator which determines if the participants pane is open.
     */
    _isParticipantsPaneOpen: boolean;

    /**
     * Whether app is currently in native PiP mode.
     */
    _isNativePipMode: boolean;

    /**
     * The ID of the participant currently on stage (if any).
     */
    _largeVideoParticipantId: string;

    /**
     * Local participant id.
     */
    _localParticipantId?: string;

    /**
     * Local participant's display name.
     */
    _localParticipantDisplayName: string;

    /**
     * Native call status mirrored from iOS.
     */
    _nativeCallStatus: string;

    /**
     * Whether Picture-in-Picture is enabled.
     */
    _pictureInPictureEnabled: boolean;

    /**
     * The indicator which determines whether the UI is reduced (to accommodate
     * smaller display areas).
     */
    _reducedUI: boolean;

    /**
     * Indicates whether the lobby screen should be visible.
     */
    _showLobby: boolean;

    /**
     * Indicates whether the car mode is enabled.
     */
    _startCarMode: boolean;

    /**
     * The indicator which determines whether the Toolbox is visible.
     */
    _toolboxVisible: boolean;

    /**
     * The redux {@code dispatch} function.
     */
    dispatch: IStore['dispatch'];

    /**
    * Object containing the safe area insets.
    */
    insets: EdgeInsets;

    /**
     * Default prop for navigating between screen components(React Navigation).
     */
    navigation: any;
}

type State = {

    /**
     * The label that is currently expanded.
     */
    visibleExpandedLabel?: string;
};

/**
 * The conference page of the mobile (i.e. React Native) application.
 */
class Conference extends AbstractConference<IProps, State> {
    /**
     * Timeout ref.
     */
    _expandedLabelTimeout: any;

    /**
     * Initializes hardwareBackPress subscription.
     */
    _hardwareBackPressSubscription: any;
    _inCallMessageSubscription: any;
    _connectionStatusSubscription: any;
    _pipModeSubscription: any;

    /**
     * Last tap timestamp used for double tap detection.
     */
    lastClickTime: number;

    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props: IProps) {
        super(props);

        this.state = {
            visibleExpandedLabel: undefined
        };

        this._expandedLabelTimeout = React.createRef<number>();

        // Bind event handlers so they are only bound once per instance.
        this._onClick = this._onClick.bind(this);
        this._onHardwareBackPress = this._onHardwareBackPress.bind(this);
        this._setToolboxVisible = this._setToolboxVisible.bind(this);
        this._createOnPress = this._createOnPress.bind(this);
        this.lastClickTime = 0;
    }

    _syncOrientationMode() {
        const { _audioOnlyEnabled, _carMode } = this.props;

        OpenMelpModule?.isAudioMode?.(_audioOnlyEnabled);

        // Car mode supports both orientations and manages the orientation lock
        // itself, so don't force portrait while it is active.
        if (_audioOnlyEnabled && !_carMode) {
            Orientation.lockToPortrait();
            OpenMelpModule?.IsRotateMode?.(false);
        } else {
            Orientation.unlockAllOrientations();
            OpenMelpModule?.IsRotateMode?.(true);
        }
    }

    /**
     * Implements {@link Component#componentDidMount()}. Invoked immediately
     * after this component is mounted.
     *
     * @inheritdoc
     * @returns {void}
     */
    override componentDidMount() {
        const {
            _audioOnlyEnabled,
            _startCarMode,
            navigation
        } = this.props;
        const connectionStatusEmitter
            = Platform.OS === 'ios' && JSCommunicateComponent
                ? new NativeEventEmitter(JSCommunicateComponent)
                : DeviceEventEmitter;

        this.props.dispatch(updateSettings({
            hasInCallMessage: false,
            isMelpChatOpen: false,
            isNativePipMode: false,
            nativeCallStatus: ''
        }));
        this._hardwareBackPressSubscription = BackHandler.addEventListener('hardwareBackPress', this._onHardwareBackPress);
        this._connectionStatusSubscription = connectionStatusEmitter.addListener(
            'connectionStatus', (event: { status?: string; } | string) => {
                const status = typeof event === 'object' ? event.status : event;
                const normalizedStatus = String(status || '').trim().replace(/\.+$/, '').toLowerCase();
                const acceptedStatuses = new Set([ 'calling', 'ringing', 'connected', 'connecting', 'reconnecting' ]);

                this.props.dispatch(updateSettings({ nativeCallStatus: status || '' }));

                if (acceptedStatuses.has(normalizedStatus)) {
                    this.props.dispatch(setConnectionStatus(normalizedStatus));
                } else if (!normalizedStatus) {
                    this.props.dispatch(setConnectionStatus('clear'));
                }
            });
        this._inCallMessageSubscription = connectionStatusEmitter.addListener(
            'setInCallMessage', () => {
                if (!this.props._isMelpChatOpen) {
                    this.props.dispatch(updateSettings({ hasInCallMessage: true }));
                }
            });
        this._pipModeSubscription = connectionStatusEmitter.addListener(
            'pictureInPictureModeChanged', (event: { isInPictureInPictureMode?: boolean; } | boolean) => {
                const isInPictureInPictureMode
                    = typeof event === 'boolean'
                        ? event
                        : Boolean(event?.isInPictureInPictureMode);

                this.props.dispatch(updateSettings({ isNativePipMode: isInPictureInPictureMode }));
            });
        this._syncOrientationMode();
        this._dismissConnectedCalleeInfoIfNeeded();

        if (_audioOnlyEnabled && _startCarMode) {
            navigation.navigate(screen.conference.carmode);
        }
    }

    /**
     * Implements {@code Component#componentDidUpdate}.
     *
     * @inheritdoc
     */
    override componentDidUpdate(prevProps: IProps) {
        const {
            _audioOnlyEnabled,
            _showLobby,
            _startCarMode
        } = this.props;

        if (!prevProps._showLobby && _showLobby) {
            navigate(screen.lobby.root);
        }

        if (prevProps._showLobby && !_showLobby) {
            if (_audioOnlyEnabled && _startCarMode) {
                return;
            }

            navigate(screen.conference.main);
        }

        if (prevProps._audioOnlyEnabled !== _audioOnlyEnabled) {
            this._syncOrientationMode();
        }

        this._dismissConnectedCalleeInfoIfNeeded();
    }

    /**
     * Implements {@link Component#componentWillUnmount()}. Invoked immediately
     * before this component is unmounted and destroyed. Disconnects the
     * conference described by the redux store/state.
     *
     * @inheritdoc
     * @returns {void}
     */
    override componentWillUnmount() {
        // Tear handling any hardware button presses for back navigation down.
        this._hardwareBackPressSubscription?.remove();
        this._inCallMessageSubscription?.remove();
        this._connectionStatusSubscription?.remove();
        this._pipModeSubscription?.remove();
        this.props.dispatch(updateSettings({
            callingType: undefined,
            hasInCallMessage: false,
            isIncomingCall: false,
            isMelpChatOpen: false,
            isNativePipMode: false,
            nativeCallStatus: '',
            nativeHoldEnabled: false,
            nativeHoldPreviousAudioMuted: undefined
        }));
        Orientation.unlockAllOrientations();
        OpenMelpModule?.IsRotateMode?.(false);

        clearTimeout(this._expandedLabelTimeout.current ?? 0);
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        const {
            _brandingStyles,
        } = this.props;

        return (
            <Container
                style = { [
                    styles.conference,
                    _brandingStyles
                ] }>
                <BrandingImageBackground />
                { this._renderContent() }
            </Container>
        );
    }

    /**
     * Changes the value of the toolboxVisible state, thus allowing us to switch
     * between Toolbox and Filmstrip and change their visibility.
     *
     * @private
     * @returns {void}
     */
    _onClick() {
        const now = Date.now();
        const isDoubleTap = now - this.lastClickTime < DOUBLE_PRESS_DELAY;

        if (isDoubleTap && !this.props._shouldDisplayTileView) {
            // Double-tap in large video → go back to tile view
           
            this.props.dispatch(setTileView(true));
        } else if (!isDoubleTap) {
            
            this._setToolboxVisible(!this.props._toolboxVisible);
        }

        this.lastClickTime = now;
    }

    /**
     * Handles a hardware button press for back navigation. Enters Picture-in-Picture mode
     * (if supported) or leaves the associated {@code Conference} otherwise.
     *
     * @returns {boolean} Exiting the app is undesired, so {@code true} is always returned.
     */
    _onHardwareBackPress() {
        let p;

        if (this.props._pictureInPictureEnabled) {
            const { PictureInPicture } = NativeModules;

            p = PictureInPicture.enterPictureInPicture();
        } else {
            p = Promise.reject(new Error('PiP not enabled'));
        }

        p.catch(() => {
            this.props.dispatch(appNavigate(undefined));
        });

        return true;
    }

    /**
     * Creates a function to be invoked when the onPress of the touchables are
     * triggered.
     *
     * @param {string} label - The identifier of the label that's onLayout is
     * triggered.
     * @returns {Function}
     */
    _createOnPress(label: string) {
        return () => {
            const { visibleExpandedLabel } = this.state;

            const newVisibleExpandedLabel
                = visibleExpandedLabel === label ? undefined : label;

            clearTimeout(this._expandedLabelTimeout.current);
            this.setState({
                visibleExpandedLabel: newVisibleExpandedLabel
            });

            if (newVisibleExpandedLabel) {
                this._expandedLabelTimeout.current = setTimeout(() => {
                    this.setState({
                        visibleExpandedLabel: undefined
                    });
                }, EXPANDED_LABEL_TIMEOUT);
            }
        };
    }

    /**
     * Renders the content for the Conference container.
     *
     * @private
     * @returns {React$Element}
     */
    _renderContent() {
        const {
            _aspectRatio,
            _audioOnlyEnabled,
            _connecting,
            _filmstripVisible,
            _isNativePipMode,
            _localParticipantId,
            _reducedUI,
            _shouldDisplayTileView,
            _toolboxVisible
        } = this.props;

        let alwaysOnTitleBarStyles;

        if (_reducedUI) {
            return this._renderContentForReducedUi();
        }

        if (_isNativePipMode) {
            return (
                <View style = { styles.pipAvatarContainer as ViewStyle }>
                    <Avatar
                        participantId = { _localParticipantId }
                        size = { 120 }
                        style = { styles.pipAvatar as ViewStyle } />
                    {
                        _connecting
                            && <TintedView>
                                <LoadingIndicator />
                            </TintedView>
                    }
                </View>
            );
        }

        if (_aspectRatio === ASPECT_RATIO_WIDE) {
            alwaysOnTitleBarStyles
                = !_shouldDisplayTileView && _filmstripVisible
                    ? styles.alwaysOnTitleBarWide
                    : styles.alwaysOnTitleBar;
        } else {
            alwaysOnTitleBarStyles = styles.alwaysOnTitleBar;

        }

        return (
            <>
                {/*
                  * The LargeVideo is the lowermost stacking layer.
                  */
                    _shouldDisplayTileView
                        ? <TileView onClick = { this._onClick } />
                        : <LargeVideo onClick = { this._onClick } />
                }

                {/*
                  * If there is a ringing call, show the callee's info.
                  */
                    <CalleeInfoContainer />
                }

                {/*
                  * The activity/loading indicator goes above everything, except
                  * the toolbox/toolbars and the dialogs.
                  */
                    _connecting
                        && <TintedView>
                            <LoadingIndicator />
                        </TintedView>
                }

                <View
                    pointerEvents = 'box-none'
                    style = { styles.toolboxAndFilmstripContainer as ViewStyle }>

                    <Captions onPress = { this._onClick } />
                    <SideToolbar />

                    { !_shouldDisplayTileView && <LonelyMeetingExperience /> }

                    {
                        _shouldDisplayTileView
                        || <>
                            <Filmstrip />
                            { this._renderNotificationsContainer() }
                            <Toolbox />
                        </>
                    }
                </View>

                <FloatingLocalThumbnail />

                <SafeAreaView
                    edges = { [ 'left', 'right', 'top' ] }
                    pointerEvents = 'box-none'
                    style = {
                        (_toolboxVisible
                            ? styles.titleBarSafeViewColor
                            : styles.titleBarSafeViewTransparent) as ViewStyle }>
                    <TitleBar _createOnPress = { this._createOnPress } />
                </SafeAreaView>

                { !_shouldDisplayTileView && (
                    <RemoteMutedBanner
                        participantId = { this.props._largeVideoParticipantId }
                        topOffset = { this.props.insets.top + 112 } />
                ) }
                <SafeAreaView
                    edges = { [ 'bottom', 'left', 'right', !_toolboxVisible && 'top' ].filter(Boolean) as Edge[] }
                    pointerEvents = 'box-none'
                    style = { styles.titleBarSafeViewTransparent as ViewStyle }>
                    <View
                        pointerEvents = 'box-none'
                        style = { styles.expandedLabelWrapper }>
                        <ExpandedLabelPopup visibleExpandedLabel = { this.state.visibleExpandedLabel } />
                    </View>
                    <View
                        pointerEvents = 'box-none'
                        style = { alwaysOnTitleBarStyles as ViewStyle }>
                        {/* eslint-disable-next-line react/jsx-no-bind */}
                        <AlwaysOnLabels createOnPress = { this._createOnPress } />
                    </View>
                </SafeAreaView>

                <TestConnectionInfo />

                {
                    _shouldDisplayTileView
                    && <>
                        { this._renderNotificationsContainer() }
                        <Toolbox />
                    </>
                }
            </>
        );
    }

    /**
     * Renders the content for the Conference container when in "reduced UI" mode.
     *
     * @private
     * @returns {React$Element}
     */
    _renderContentForReducedUi() {
        const { _connecting } = this.props;

        return (
            <>
                <LargeVideo onClick = { this._onClick } />

                {
                    _connecting
                        && <TintedView>
                            <LoadingIndicator />
                        </TintedView>
                }
            </>
        );
    }

    /**
     * Renders a container for notifications to be displayed by the
     * base/notifications feature.
     *
     * @private
     * @returns {React$Element}
     */
    _renderNotificationsContainer() {
        const notificationsStyle: ViewStyle = {};

        // In the landscape mode (wide) there's problem with notifications being
        // shadowed by the filmstrip rendered on the right. This makes the "x"
        // button not clickable. In order to avoid that a margin of the
        // filmstrip's size is added to the right.
        //
        // Pawel: after many attempts I failed to make notifications adjust to
        // their contents width because of column and rows being used in the
        // flex layout. The only option that seemed to limit the notification's
        // size was explicit 'width' value which is not better than the margin
        // added here.
        const { _aspectRatio, _filmstripVisible } = this.props;
        const isWideIosFilmstripOnLeft = Platform.OS === 'ios' && _aspectRatio !== ASPECT_RATIO_NARROW;

        if (_filmstripVisible && _aspectRatio !== ASPECT_RATIO_NARROW) {
            if (isWideIosFilmstripOnLeft) {
                notificationsStyle.marginLeft = FILMSTRIP_SIZE;
            } else {
                notificationsStyle.marginRight = FILMSTRIP_SIZE;
            }
        }

        return super.renderNotificationsContainer(
            {
                shouldDisplayTileView: this.props._shouldDisplayTileView,
                style: notificationsStyle,
                toolboxVisible: this.props._toolboxVisible
            }
        );
    }

    _dismissConnectedCalleeInfoIfNeeded() {
        const {
            _calleeInfoVisible,
            _hasConnectedRemoteParticipant,
            _nativeCallStatus,
            dispatch
        } = this.props;

        if (_calleeInfoVisible
            && !_hasConnectedRemoteParticipant
            && _nativeCallStatus === 'Connected') {
            dispatch(setCalleeInfoVisible(false));
        }
    }

    /**
     * Dispatches an action changing the visibility of the {@link Toolbox}.
     *
     * @private
     * @param {boolean} visible - Pass {@code true} to show the
     * {@code Toolbox} or {@code false} to hide it.
     * @returns {void}
     */
    _setToolboxVisible(visible: boolean) {
        this.props.dispatch(setToolboxVisible(visible));
    }
}

/**
 * Maps (parts of) the redux state to the associated {@code Conference}'s props.
 *
 * @param {Object} state - The redux state.
 * @param {any} _ownProps - Component's own props.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, _ownProps: any) {
    const { isOpen } = state['features/participants-pane'];
    const { aspectRatio, reducedUI } = state['features/base/responsive-ui'];
    const { backgroundColor } = state['features/dynamic-branding'];
    const settings: any = state['features/base/settings'];
    const { startCarMode } = settings;
    const { enabled: audioOnlyEnabled } = state['features/base/audio-only'];
    const localParticipant = getLocalParticipant(state);
    const remoteParticipants = getRemoteParticipants(state);
    const brandingStyles = backgroundColor ? {
        background: backgroundColor
    } : undefined;
    const hasConnectedRemoteParticipant
        = Array.from(remoteParticipants.values()).some(participant => !isScreenShareParticipant(participant));

    return {
        ...abstractMapStateToProps(state),
        _aspectRatio: aspectRatio,
        _audioOnlyEnabled: Boolean(audioOnlyEnabled),
        _brandingStyles: brandingStyles,
        _carMode: state['features/video-layout'].carMode,
        _calleeInfoVisible: Boolean(state['features/invite'].calleeInfoVisible),
        _calendarEnabled: isCalendarEnabled(state),
        _connecting: isConnecting(state),
        _disableSelfView: getHideSelfView(state),
        _filmstripVisible: isFilmstripVisible(state),
        _hasConnectedRemoteParticipant: hasConnectedRemoteParticipant,
        _isMelpChatOpen: Boolean(settings?.isMelpChatOpen),
        _isNativePipMode: Boolean(settings?.isNativePipMode),
        _isParticipantsPaneOpen: isOpen,
        _largeVideoParticipantId: state['features/large-video'].participantId,
        _localParticipantId: localParticipant?.id,
        _nativeCallStatus: settings?.nativeCallStatus || '',
        _pictureInPictureEnabled: isPipEnabled(state),
        _reducedUI: reducedUI,
        _showLobby: getIsLobbyVisible(state),
        _startCarMode: startCarMode,
        _toolboxVisible: isToolboxVisible(state)
    };
}

export default withSafeAreaInsets(connect(_mapStateToProps)(props => {
    const dispatch = useDispatch();

    useFocusEffect(useCallback(() => {
        dispatch({ type: CONFERENCE_FOCUSED });
        setPictureInPictureEnabled(true);

        return () => {
            dispatch({ type: CONFERENCE_BLURRED });
            setPictureInPictureEnabled(false);
        };
    }, []));

    return ( // @ts-ignore
        <Conference { ...props } />
    );
}));
