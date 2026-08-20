import React, { PureComponent } from 'react';
import { Image, ImageStyle, Text, View, ViewStyle } from 'react-native';
import { batch, connect } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import { JitsiTrackEvents } from '../../../base/lib-jitsi-meet';
import { MEDIA_TYPE, VIDEO_TYPE } from '../../../base/media/constants';
import { pinParticipant } from '../../../base/participants/actions';
import ParticipantView from '../../../base/participants/components/ParticipantView.native';
import { PARTICIPANT_ROLE } from '../../../base/participants/constants';
import {
    getLocalParticipant,
    getParticipantByIdOrUndefined,
    getParticipantCount,
    getParticipantDisplayName,
    hasRaisedHand,
    getParticipantCountWithFake,
    isEveryoneModerator,
    isScreenShareParticipant
} from '../../../base/participants/functions';
import { shouldRenderVideoTrack } from '../../../base/media/functions';
import { FakeParticipant } from '../../../base/participants/types';
import Container from '../../../base/react/components/native/Container';
import { StyleType } from '../../../base/styles/functions.any';
import { trackStreamingStatusChanged } from '../../../base/tracks/actions.native';
import {
    getTrackByMediaTypeAndParticipant,
    getVideoTrackByParticipant
} from '../../../base/tracks/functions.native';
import { ITrack } from '../../../base/tracks/types';
import { getChatTtsSpeakerId } from '../../../caption-tts/functions.native';
import ConnectionIndicator from '../../../connection-indicator/components/native/ConnectionIndicator';
import DisplayNameLabel from '../../../display-name/components/native/DisplayNameLabel';
import { getGifDisplayMode, getGifForParticipant } from '../../../gifs/functions.native';
import { selectParticipantInLargeVideo } from '../../../large-video/actions.any';
import { LIVE_TRANSLATION_MIC_ON, LIVE_TRANSLATION_SPEAKING_ON } from '../../../live-translation/constants';
import { getLiveTranslationState } from '../../../live-translation/functions.native';
import {
    showConnectionStatus,
    showContextMenuDetails,
    showSharedVideoMenu
} from '../../../participants-pane/actions.native';
import { toggleToolboxVisible } from '../../../toolbox/actions.native';
import { isToolboxVisible } from '../../../toolbox/functions.native';
import { shouldDisplayTileView } from '../../../video-layout/functions.native';
import { setTileView } from '../../../video-layout/actions.native';
import VoiceTranslationTileIndicators from '../../../voice-translation/components/native/VoiceTranslationTileIndicators';
import { SQUARE_TILE_ASPECT_RATIO } from '../../constants';

import AudioMutedIndicator from './AudioMutedIndicator';
import ModeratorIndicator from './ModeratorIndicator';
import PinnedIndicator from './PinnedIndicator';
import RaisedHandIndicator from './RaisedHandIndicator';
import ScreenShareIndicator from './ScreenShareIndicator';
import ThumbnailAudioIndicator from './ThumbnailAudioIndicator';
import styles, { AVATAR_SIZE } from './styles';

const DOUBLE_TAP_TIMEOUT_MS = 200;

/**
 * The audio level, on the 0..1 scale lib-jitsi-meet reports, above which somebody counts as speaking. The same value the
 * speaker wave treats as active, so the outline and the wave agree.
 */
const SPEAKING_AUDIO_LEVEL = 0.02;

/**
 * How long the outline stays up after the last loud sample, so that it does not blink between words.
 */
const SPEAKING_HOLD_MS = 1000;



/**
 * Thumbnail component's property types.
 */
interface IProps {

    /**
     * Whether local audio (microphone) is muted or not.
     */
    _audioMuted: boolean;

    /**
     * The audio track that will be displayed in the thumbnail.
     */
    _audioTrack?: ITrack;

    /**
     * The type of participant if the participant is fake.
     */
    _fakeParticipant?: FakeParticipant;

    /**
     * URL of GIF sent by this participant, null if there's none.
     */
    _gifSrc?: string;

    /**
     * Indicates whether the participant is screen sharing.
     */
    /**
     * Whether this participant is taking part in a translated call, in which case their dictation says exactly when they
     * start and stop talking and nothing else has to be guessed at.
     */
    _inTranslatedCall: boolean;

    _isScreenShare: boolean;

    /**
     * Indicates whether the thumbnail is for a virtual screenshare participant.
     */
    _isVirtualScreenshare: boolean;

    /**
     * Indicates whether the participant is local.
     */
    _local?: boolean;

    /**
     * Shared video local participant owner.
     */
    _localVideoOwner: boolean;

    /**
     * The indicator which determines whether the Toolbox is visible.
     */
     _toolboxVisible: boolean

    /**
     * The ID of the participant obtain from the participant object in Redux.
     *
     * NOTE: Generally it should be the same as the participantID prop except the case where the passed
     * participantID doesn't correspond to any of the existing participants.
     */
    _participantId: string;

    /**
     * The name shown on the tile while the participant is being recorded.
     */
    _participantDisplayName: string;

    /**
     * Indicates whether the participant is pinned or not.
     */
    _pinned?: boolean;

    /**
     * Whether or not the participant has the hand raised.
     */
    _raisedHand: boolean;

    /**
     * Whether to show the dominant speaker indicator or not.
     */
    _renderDominantSpeakerIndicator?: boolean;

    /**
     * Whether to show the moderator indicator or not.
     */
    _renderModeratorIndicator: boolean;

    /**
     * Whether the speaking outline has to be worked out from the audio level rather than taken from the dominant
     * speaker, which the conference does not report usefully in a call this small.
     */
    _speakingFromAudioLevel: boolean;

    /**
     * Whether the participant is speaking into a translated call, as announced by their own dictation.
     */
    _speakingInTranslatedCall: boolean;

    _shouldDisplayTileView: boolean;

    /**
     * Whether what this participant said is being read out in translation on this device right now.
     */
    _translating: boolean;

    /**
     * The video track that will be displayed in the thumbnail.
     */
    _videoTrack?: ITrack;
    _deviceType?: string;
    /**
     * Invoked to trigger state changes in Redux.
     */
    dispatch: IStore['dispatch'];

    /**
     * The height of the thumbnail.
     */
    height?: number;

    /**
     * The ID of the participant related to the thumbnail.
     */
    participantID?: string;

    /**
     * Whether to display or hide the display name of the participant in the thumbnail.
     */
    renderDisplayName?: boolean;

    /**
     * Whether to show the audio indicator in the thumbnail.
     */
    showAudioIndicator?: boolean;

    /**
     * If true, hide the audio indicator when video is rendering.
     */
    hideAudioIndicatorWhenVideoOn?: boolean;

    /**
     * If true, it tells the thumbnail that it needs to behave differently. E.g. React differently to a single tap.
     */
    tileView?: boolean;

    /**
     * Whether to disable dominant speaker highlighting for this thumbnail.
     */
    disableDominantSpeakerIndicator?: boolean;

    /**
     * Whether tile-view margin should be disabled for custom containers such
     * as the floating local thumbnail.
     */
    disableTileViewMargin?: boolean;

    /**
     * Optional border radius override for the thumbnail and its video clip.
     */
    borderRadius?: number;

    /**
     * Optional border width override.
     */
    borderWidth?: number;

    /**
     * Optional background color override for the thumbnail shell and video
     * clip container.
     */
    backgroundColor?: string;

      /**
     * The width of the thumnail.
     */
      width?: number,
}

interface IState {

    /**
     * Whether the participant is speaking judging by their audio level. Only used where the conference does not report a
     * usable dominant speaker.
     */
    _speakingByAudioLevel: boolean;
}

/**
 * React component for video thumbnail.
 */
class Thumbnail extends PureComponent<IProps, IState> {
    /**
     * Timeout used to detect double tapping on tile view.
     */
    _doubleTapTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Timeout that takes the speaking outline back down once the participant has been quiet for a moment.
     */
    _speakingTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Creates new Thumbnail component.
     *
     * @param {IProps} props - The props of the component.
     * @returns {Thumbnail}
     */
    constructor(props: IProps) {
        super(props);

        this.state = {
            _speakingByAudioLevel: false
        };

        this._onClick = this._onClick.bind(this);
        this._onThumbnailLongPress = this._onThumbnailLongPress.bind(this);
        this.handleTrackStreamingStatusChanged = this.handleTrackStreamingStatusChanged.bind(this);
        this._handleTileViewSingleTap = this._handleTileViewSingleTap.bind(this);
        this._handleTileViewDoubleTap = this._handleTileViewDoubleTap.bind(this);
        this._onAudioLevelChanged = this._onAudioLevelChanged.bind(this);
    }

    /**
     * Raises the speaking outline on a loud enough sample and arms the timeout that lowers it again.
     *
     * @param {number} audioLevel - The audio level of the track, from 0 to 1.
     * @returns {void}
     */
    _onAudioLevelChanged(audioLevel: number) {
        if (audioLevel < SPEAKING_AUDIO_LEVEL) {
            return;
        }

        if (this._speakingTimeout) {
            clearTimeout(this._speakingTimeout);
        }

        this._speakingTimeout = setTimeout(() => {
            this._speakingTimeout = undefined;
            this.setState({ _speakingByAudioLevel: false });
        }, SPEAKING_HOLD_MS);

        if (!this.state._speakingByAudioLevel) {
            this.setState({ _speakingByAudioLevel: true });
        }
    }

    /**
     * Starts or stops watching the audio level of the given track.
     *
     * @param {ITrack} audioTrack - The track to listen to.
     * @param {boolean} listen - Whether to start listening or to stop.
     * @returns {void}
     */
    _watchAudioLevel(audioTrack: ITrack | undefined, listen: boolean) {
        const jitsiTrack = audioTrack?.jitsiTrack;

        if (!jitsiTrack) {
            return;
        }

        if (listen) {
            jitsiTrack.on(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, this._onAudioLevelChanged);
        } else {
            jitsiTrack.off(JitsiTrackEvents.TRACK_AUDIO_LEVEL_CHANGED, this._onAudioLevelChanged);
        }
    }

    /**
     * Drops the speaking outline and forgets the timeout behind it.
     *
     * @returns {void}
     */
    _clearSpeaking() {
        if (this._speakingTimeout) {
            clearTimeout(this._speakingTimeout);
            this._speakingTimeout = undefined;
        }

        if (this.state._speakingByAudioLevel) {
            this.setState({ _speakingByAudioLevel: false });
        }
    }

    /**
     * Thumbnail click handler.
     *
     * @returns {void}
     */
    _onClick() {
        const { _participantId, _pinned, dispatch, tileView } = this.props;

        if (!tileView) {
            dispatch(pinParticipant(_pinned ? null : _participantId));
            return;
        }

        if (this._doubleTapTimeout) {
            clearTimeout(this._doubleTapTimeout);
            this._doubleTapTimeout = undefined;
            this._handleTileViewDoubleTap();
            return;
        }

        this._doubleTapTimeout = setTimeout(this._handleTileViewSingleTap, DOUBLE_TAP_TIMEOUT_MS);
    }

    /**
     * Single tap handler for tile view thumbnails.
     *
     * @returns {void}
     */
    _handleTileViewSingleTap() {
        this._doubleTapTimeout = undefined;
        this.props.dispatch(toggleToolboxVisible());
    }

    /**
     * Double tap handler for tile view thumbnails.
     *
     * @returns {void}
     */
    _handleTileViewDoubleTap() {
        const { _participantId, dispatch } = this.props;

        if (_participantId) {
            batch(() => {
                dispatch(pinParticipant(_participantId));
                dispatch(selectParticipantInLargeVideo(_participantId));
                dispatch(setTileView(false));
            });
        }
    }

    /**
     * Thumbnail long press handler.
     *
     * @returns {void}
     */
    _onThumbnailLongPress() {
        if (this._doubleTapTimeout) {
            clearTimeout(this._doubleTapTimeout);
            this._doubleTapTimeout = undefined;
        }
        const { _fakeParticipant, _participantId, _local, _localVideoOwner, dispatch, tileView } = this.props;

        if (!_fakeParticipant) {
            if (!_local) {
                dispatch(showContextMenuDetails(_participantId, false, { compact: Boolean(tileView) }));
             }
            }
        // if (_fakeParticipant && _localVideoOwner) {
        //     dispatch(showSharedVideoMenu(_participantId));
        // } 
        // else if (!_fakeParticipant) {
        //     if (_local) {
        //         dispatch(showConnectionStatus(_participantId));
        //     } else {
        //         dispatch(showContextMenuDetails(_participantId));
        //     }
        // }  added by jaswant
        // else no-op
    }

    /**
     * Renders the indicators for the thumbnail.
     *
     * @returns {ReactElement}
     */
    _renderIndicators() {
        const {
            _audioMuted: audioMuted,
            _audioTrack: audioTrack,
            _fakeParticipant,
            _isScreenShare: isScreenShare,
            _isVirtualScreenshare,
            _participantId: participantId,
            _pinned,
            _renderModeratorIndicator: renderModeratorIndicator,
            _shouldDisplayTileView,
            renderDisplayName,
            tileView,
            _deviceType
        } = this.props;
        const indicators = [];

        let bottomIndicatorsContainerStyle;

        if (_shouldDisplayTileView) {
            bottomIndicatorsContainerStyle = styles.bottomIndicatorsContainer;
        } else if (audioMuted || renderModeratorIndicator) {
            bottomIndicatorsContainerStyle = styles.bottomIndicatorsContainer;
        } else {
            bottomIndicatorsContainerStyle = null;
        }

        if (!_fakeParticipant || _isVirtualScreenshare) {
            indicators.push(<View
                key = 'top-left-indicators'
                style = { styles.thumbnailTopLeftIndicatorContainer as ViewStyle }>
                { !_isVirtualScreenshare && <ConnectionIndicator participantId = { participantId } /> }
                { !_isVirtualScreenshare && <RaisedHandIndicator participantId = { participantId } tileView = { tileView } /> }
                { tileView && (isScreenShare || _isVirtualScreenshare) && (
                    <View style = { styles.screenShareIndicatorContainer as ViewStyle }>
                        <ScreenShareIndicator />
                    </View>
                ) }
            </View>);
            indicators.push(<Container
                key = 'bottom-indicators'
                style = { styles.thumbnailIndicatorContainer as StyleType }>
                <Container
                    style = { bottomIndicatorsContainerStyle as StyleType }>
                    { audioMuted && !_isVirtualScreenshare && <AudioMutedIndicator /> }
                    {/* { !tileView && _pinned && <PinnedIndicator />} */}
                    { renderModeratorIndicator && !_isVirtualScreenshare && <ModeratorIndicator />}
                    { !tileView && (isScreenShare || _isVirtualScreenshare) && <ScreenShareIndicator /> }
                </Container>
                {
                    renderDisplayName && <DisplayNameLabel
                        contained = { true }
                        participantId = { participantId }
                        deviceType = {_deviceType} />
                }
            </Container>);
        }

        return indicators;
    }

    /**
     * Starts listening for track streaming status updates after the initial render.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidMount() {
        // Listen to track streaming status changed event to keep it updated.
        // TODO: after converting this component to a react function component,
        // use a custom hook to update local track streaming status.
        const { _audioTrack, _speakingFromAudioLevel, _videoTrack, dispatch } = this.props;

        if (_videoTrack && !_videoTrack.local) {
            _videoTrack.jitsiTrack.on(JitsiTrackEvents.TRACK_STREAMING_STATUS_CHANGED,
                this.handleTrackStreamingStatusChanged);
            dispatch(trackStreamingStatusChanged(_videoTrack.jitsiTrack,
                _videoTrack.jitsiTrack.getTrackStreamingStatus()));
        }

        if (_speakingFromAudioLevel) {
            this._watchAudioLevel(_audioTrack, true);
        }
    }

    /**
     * Stops listening for track streaming status updates on the old track and starts listening instead on the new
     * track.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidUpdate(prevProps: IProps) {
        // TODO: after converting this component to a react function component,
        // use a custom hook to update local track streaming status.
        const { _videoTrack, dispatch } = this.props;

        if (prevProps._videoTrack?.jitsiTrack?.getSourceName() !== _videoTrack?.jitsiTrack?.getSourceName()) {
            if (prevProps._videoTrack && !prevProps._videoTrack.local) {
                prevProps._videoTrack.jitsiTrack.off(JitsiTrackEvents.TRACK_STREAMING_STATUS_CHANGED,
                    this.handleTrackStreamingStatusChanged);
                dispatch(trackStreamingStatusChanged(prevProps._videoTrack.jitsiTrack,
                    prevProps._videoTrack.jitsiTrack.getTrackStreamingStatus()));
            }
            if (_videoTrack && !_videoTrack.local) {
                _videoTrack.jitsiTrack.on(JitsiTrackEvents.TRACK_STREAMING_STATUS_CHANGED,
                    this.handleTrackStreamingStatusChanged);
                dispatch(trackStreamingStatusChanged(_videoTrack.jitsiTrack,
                    _videoTrack.jitsiTrack.getTrackStreamingStatus()));
            }
        }

        const { _audioTrack, _speakingFromAudioLevel } = this.props;
        const trackChanged = prevProps._audioTrack?.jitsiTrack !== _audioTrack?.jitsiTrack;

        if (trackChanged || prevProps._speakingFromAudioLevel !== _speakingFromAudioLevel) {
            if (prevProps._speakingFromAudioLevel) {
                this._watchAudioLevel(prevProps._audioTrack, false);
            }

            if (_speakingFromAudioLevel) {
                this._watchAudioLevel(_audioTrack, true);
            } else {
                this._clearSpeaking();
            }
        }
    }

    /**
     * Remove listeners for track streaming status update.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentWillUnmount() {
        if (this._doubleTapTimeout) {
            clearTimeout(this._doubleTapTimeout);
            this._doubleTapTimeout = undefined;
        }

        if (this._speakingTimeout) {
            clearTimeout(this._speakingTimeout);
            this._speakingTimeout = undefined;
        }

        this._watchAudioLevel(this.props._audioTrack, false);

        // TODO: after converting this component to a react function component,
        // use a custom hook to update local track streaming status.
        const { _videoTrack, dispatch } = this.props;

        if (_videoTrack && !_videoTrack.local) {
            _videoTrack.jitsiTrack.off(JitsiTrackEvents.TRACK_STREAMING_STATUS_CHANGED,
                this.handleTrackStreamingStatusChanged);
            dispatch(trackStreamingStatusChanged(_videoTrack.jitsiTrack,
                _videoTrack.jitsiTrack.getTrackStreamingStatus()));
        }
    }

    /**
     * Handle track streaming status change event by by dispatching an action to update track streaming status for the
     * given track in app state.
     *
     * @param {JitsiTrack} jitsiTrack - The track with streaming status updated.
     * @param {JitsiTrackStreamingStatus} streamingStatus - The updated track streaming status.
     * @returns {void}
     */
    handleTrackStreamingStatusChanged(jitsiTrack: any, streamingStatus: string) {
        this.props.dispatch(trackStreamingStatusChanged(jitsiTrack, streamingStatus));
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const {
            disableDominantSpeakerIndicator,
            _audioMuted,
            _fakeParticipant,
            _gifSrc,
            _inTranslatedCall,
            _isScreenShare: isScreenShare,
            _isVirtualScreenshare,
            _local,
            _participantDisplayName,
            _participantId: participantId,
            _raisedHand,
            _renderDominantSpeakerIndicator,
            _speakingInTranslatedCall,
            _translating,
            _videoTrack,
            backgroundColor,
            borderRadius,
            borderWidth,
            disableTileViewMargin,
            height,
            hideAudioIndicatorWhenVideoOn,
            showAudioIndicator,
            tileView,
            width
        } = this.props;
        const effectiveTileBorderRadius = tileView ? (borderRadius ?? 15) : borderRadius;
        const disableVideo = !tileView && (isScreenShare || _fakeParticipant);
        const isVideoOn = Boolean(_videoTrack) && !disableVideo && shouldRenderVideoTrack(_videoTrack, false);
        const tileBackgroundColor = tileView && !isVideoOn ? '#000000a4' : backgroundColor;
        const styleOverrides = tileView ? {
            aspectRatio: width/height,
            backgroundColor: tileBackgroundColor,
            borderRadius: effectiveTileBorderRadius,
            flex: 0,
            borderWidth: borderWidth ?? 2,
            height,
            margin: disableTileViewMargin ? 0 : 2,
            maxHeight: height,
            maxWidth: null,
            width: width
        } : null;
        const indicatorStyle: ViewStyle = {
            bottom: tileView ? 10 : 6
        };
        const shouldShowAudioIndicator = (showAudioIndicator ?? true)
            && !(hideAudioIndicatorWhenVideoOn && isVideoOn);

        // Somebody in a translated call has their own voice activity detector reporting them, which says when they stop
        // as precisely as it says when they start. The dominant speaker deliberately does not: the conference leaves it
        // on the last person who spoke until somebody else does, which is useful for choosing a large video and useless
        // for an outline, since it would stay lit long after they finished. Below three participants there is no
        // dominant speaker worth having either, and the audio level of the track stands in for it.
        const isSpeaking = _inTranslatedCall
            ? _speakingInTranslatedCall
            : Boolean(_renderDominantSpeakerIndicator) || this.state._speakingByAudioLevel;

        // Nobody with their microphone closed is speaking, whatever anything else still says.
        const showSpeakingOutline = isSpeaking
            && !_audioMuted
            && !_isVirtualScreenshare
            && !disableDominantSpeakerIndicator;

        // The red outline says somebody is being recorded; on a remote tile there is room to say who.
        const showRecordingBadge = showSpeakingOutline && Boolean(tileView) && !_local;

        // What somebody said reaches this device as text and is read out in translation a moment later, which is a
        // second thing worth seeing on their tile - and it lands after they have stopped talking, so it never has to
        // compete with the recording badge for the same corner.
        const showTranslatingBadge = _translating && Boolean(tileView) && !_local && !showRecordingBadge;

        return (
            <Container
                onClick = { this._onClick }
                onLongPress = { this._onThumbnailLongPress }
                style = { [
                    styles.thumbnail,
                    styleOverrides,
                    _raisedHand && !_isVirtualScreenshare ? styles.thumbnailRaisedHand : null,
                    showSpeakingOutline ? styles.thumbnailDominantSpeaker : null
                ] as StyleType[] }
                touchFeedback = { false }>
                { _gifSrc ? <Image
                    source = {{ uri: _gifSrc }}
                    style = { styles.thumbnailGif as ImageStyle } />
                    : <>
                        <View
                            style = { [
                                styles.thumbnailVideoClip,
                                tileBackgroundColor ? { backgroundColor: tileBackgroundColor } : null,
                                effectiveTileBorderRadius ? { borderRadius: effectiveTileBorderRadius } : null
                            ] as ViewStyle[] }>
                            <ParticipantView
                                avatarSize = { tileView ? AVATAR_SIZE * 1.5 : AVATAR_SIZE }
                                disableVideo = { disableVideo }
                                participantId = { participantId }
                                showAudioIndicator = { shouldShowAudioIndicator }
                                showSpeakerWave = { Boolean(tileView) }
                                showStatusLabel = { Boolean(tileView) }
                                videoBorderRadius = { effectiveTileBorderRadius }
                                zOrder = { 1 } />
                                
                        </View>
                        
                        {
                            this._renderIndicators()
                        }
                        { tileView && !isScreenShare && !_isVirtualScreenshare && (
                            <VoiceTranslationTileIndicators participantId = { participantId } />
                        ) }
                        { showRecordingBadge && (
                            <View
                                pointerEvents = 'none'
                                style = { styles.thumbnailRecordingBadge as ViewStyle }>
                                <View style = { styles.thumbnailRecordingBadgeDot as ViewStyle } />
                                <Text
                                    numberOfLines = { 1 }
                                    style = { styles.thumbnailRecordingBadgeText }>
                                    { `${_participantDisplayName} is speaking` }
                                </Text>
                            </View>
                        ) }
                        { showTranslatingBadge && (
                            <View
                                pointerEvents = 'none'
                                style = { styles.thumbnailTranslatingBadge as ViewStyle }>
                                <View style = { styles.thumbnailTranslatingBadgeDot as ViewStyle } />
                                <Text
                                    numberOfLines = { 1 }
                                    style = { styles.thumbnailRecordingBadgeText }>
                                    { `${_participantDisplayName} is translating` }
                                </Text>
                            </View>
                        ) }
                    </>
                }
            </Container>
        );
    }
}

/**
 * Function that maps parts of Redux state tree into component props.
 *
 * @param {Object} state - Redux state.
 * @param {IProps} ownProps - Properties of component.
 * @returns {Object}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    const { ownerId } = state['features/shared-video'];
    const tracks = state['features/base/tracks'];
    const { participantID, tileView } = ownProps;
    const participant = getParticipantByIdOrUndefined(state, participantID);
    const localParticipantId = getLocalParticipant(state)?.id;
    const id = participant?.id;
    const audioTrack = getTrackByMediaTypeAndParticipant(tracks, MEDIA_TYPE.AUDIO, id);
    const {
        active: liveTranslationActive,
        dictating: liveTranslationDictating,
        micOn: liveTranslationMicOn
    } = getLiveTranslationState(state);

    // During a translated call the conference microphone is muted throughout and the microphone the recorder listens
    // through is the one that means anything, so that is the one the tile shows: the local user's own comes out of the
    // call state, everybody else's out of what they announce in presence. Tiles of anybody not in a translated call are
    // unaffected - what they transmit is what their track says.
    let audioMuted;

    if (liveTranslationActive && participant?.local) {
        audioMuted = !liveTranslationMicOn;
    } else if (participant?.liveTranslationMic) {
        audioMuted = participant.liveTranslationMic !== LIVE_TRANSLATION_MIC_ON;
    } else {
        audioMuted = audioTrack?.muted ?? true;
    }

    // Who is talking is announced rather than measured: the local user's state comes straight out of the recorder, and
    // everybody else's out of presence. Only participants who are in a translated call have any of this to announce.
    const inTranslatedCall = Boolean(liveTranslationActive && participant?.local)
        || Boolean(participant?.liveTranslationMic);
    let speakingInTranslatedCall;

    if (liveTranslationActive && participant?.local) {
        speakingInTranslatedCall = liveTranslationMicOn && liveTranslationDictating;
    } else {
        speakingInTranslatedCall = participant?.liveTranslationSpeaking === LIVE_TRANSLATION_SPEAKING_ON;
    }
    const videoTrack = getVideoTrackByParticipant(state, participant);
    const isScreenShare = videoTrack?.videoType === VIDEO_TYPE.DESKTOP;
    const participantCount = getParticipantCountWithFake(state);
    const renderDominantSpeakerIndicator = participant?.dominantSpeaker && participantCount > 2;
    const _isEveryoneModerator = isEveryoneModerator(state);
    const renderModeratorIndicator = participant?.role === PARTICIPANT_ROLE.MODERATOR;
    const { gifUrl: gifSrc } = getGifForParticipant(state, id ?? '');
    const mode = getGifDisplayMode(state);
    const deviceType = participant?.deviceType;

    const { tileViewDimensions } = state['features/filmstrip'];
    const width1 = typeof ownProps.width === 'number'
        ? ownProps.width
        : tileViewDimensions.thumbnailSize.width;
    const height1 = typeof ownProps.height === 'number'
        ? ownProps.height
        : tileViewDimensions.thumbnailSize.height;

    return {
        _audioMuted: audioMuted,
        _audioTrack: audioTrack,
        _fakeParticipant: participant?.fakeParticipant,
        _gifSrc: mode === 'chat' ? undefined : gifSrc,
        _isScreenShare: isScreenShare,
        _isVirtualScreenshare: isScreenShareParticipant(participant),
        _local: participant?.local,
        _localVideoOwner: Boolean(ownerId === localParticipantId),
        _participantDisplayName: getParticipantDisplayName(state, id ?? ''),
        _participantId: id ?? '',
        _pinned: participant?.pinned,
        _raisedHand: hasRaisedHand(participant),
        _renderDominantSpeakerIndicator: renderDominantSpeakerIndicator,
        _renderModeratorIndicator: renderModeratorIndicator,
        _shouldDisplayTileView: shouldDisplayTileView(state),
        _speakingFromAudioLevel: participantCount <= 2,
        _inTranslatedCall: inTranslatedCall,
        _speakingInTranslatedCall: Boolean(speakingInTranslatedCall),
        _translating: Boolean(id) && getChatTtsSpeakerId(state) === id,
        _videoTrack: videoTrack,
        width: width1,
        height: height1,
        _toolboxVisible: isToolboxVisible(state),
        _deviceType: deviceType
    };
}

export default connect(_mapStateToProps)(Thumbnail);
