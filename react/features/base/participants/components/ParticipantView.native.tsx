import React, { Component } from 'react';
import { Animated, Easing, GestureResponderEvent, Text, TextStyle, View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import {
    isTrackStreamingStatusActive,
    isTrackStreamingStatusInactive,
    isTrackStreamingStatusInterrupted
} from '../../../connection-indicator/functions';
import ThumbnailAudioIndicator from '../../../filmstrip/components/native/ThumbnailAudioIndicator';
import { isS2SV2Active, isS2SV2ParticipantTranslating } from '../../../s2s-v2/functions';
import SharedVideo from '../../../shared-video/components/native/SharedVideo';
import { isSharedVideoEnabled } from '../../../shared-video/functions';
import { isVoiceTranslationEnabled } from '../../../voice-translation/functions';
import { IStateful } from '../../app/types';
import Avatar from '../../avatar/components/Avatar';
import { translate } from '../../i18n/functions';
import VideoTrack from '../../media/components/native/VideoTrack';
import { MEDIA_TYPE } from '../../media/constants';
import { shouldRenderVideoTrack } from '../../media/functions';
import Container from '../../react/components/native/Container';
import { toState } from '../../redux/functions';
import { StyleType } from '../../styles/functions.any';
import TestHint from '../../testing/components/TestHint';
import {
    getTrackByMediaTypeAndParticipant,
    getVideoTrackByParticipant,
    isParticipantAudioMuted
} from '../../tracks/functions';
import { ITrack } from '../../tracks/types';
import { getParticipantById, getParticipantDisplayName, isSharedVideoParticipant } from '../functions';

import styles from './styles';

/**
 * The type of the React {@link Component} props of {@link ParticipantView}.
 */
interface IProps {

    /**
     * Whether the connection is inactive or not.
     *
     * @private
     */
    _isConnectionInactive: boolean;

    /**
     * Whether the connection is interrupted or not.
     */
    _isConnectionInterrupted: boolean;

    /**
     * Whether the participant is a shared video participant.
     */
    _isSharedVideoParticipant: boolean;

    /**
     * Whether the participant is having their speech translated for the room.
     */
    _isS2SV2Translating: boolean;

    /**
     * Whether voice translation is active for the meeting.
     */
    _isVoiceTranslationActive: boolean;

    /**
     * Whether the participant's audio is muted.
     */
    _isAudioMuted: boolean;

    /**
     * Whether the participant is on hold.
     */
    _isOnHold: boolean;

    /**
     * Whether this participant is currently dominant speaker.
     */
    _isDominantSpeaker: boolean;

    /**
     * Whether the participant is local.
     */
    _isLocal: boolean;

    /**
     * The name of the participant which this component represents.
     *
     * @private
     */
    _participantName: string;

    /**
     * True if the video should be rendered, false otherwise.
     */
    _renderVideo: boolean;

    /**
     * Whether the shared video is enabled or not.
     */
    _sharedVideoEnabled: boolean;

    /**
     * The video Track of the participant with {@link #participantId}.
     */
    _videoTrack?: ITrack;

    /**
     * The audio Track of the participant with {@link #participantId}.
     */
    _audioTrack?: ITrack;

    /**
     * The avatar size.
     */
    avatarSize: number;

    /**
     * Whether video should be disabled for his view.
     */
    disableVideo?: boolean;

    /**
     * Callback to invoke when the {@code ParticipantView} is clicked/pressed.
     */
    onPress: (e?: GestureResponderEvent) => void;

    /**
     * The ID of the participant (to be) depicted by {@link ParticipantView}.
     *
     * @public
     */
    participantId: string;

    /**
     * The style, if any, to apply to {@link ParticipantView} in addition to its
     * default style.
     */
    style: StyleType;

    /**
     * Whether to show the audio wave indicator.
     */
    showAudioIndicator?: boolean;

    /**
     * Whether to show the speaker wave in avatar-only thumbnails.
     */
    showSpeakerWave?: boolean;

    /**
     * Whether to show status labels (on-hold/translation) for this view.
     */
    showStatusLabel?: boolean;

    /**
     * Optional border radius to apply to the live video renderer.
     */
    videoBorderRadius?: number;

    /**
     * Optional style overrides for the audio indicator container.
     */
    audioIndicatorStyle?: ViewStyle;

    /**
     * The function to translate human-readable text.
     */
    t: Function;

    /**
     * The test hint id which can be used to locate the {@code ParticipantView}
     * on the jitsi-meet-torture side. If not provided, the
     * {@code participantId} with the following format will be used:
     * {@code `org.jitsi.meet.Participant#${participantId}`}.
     */
    testHintId?: string;

    /**
     * Indicates if the connectivity info label should be shown, if appropriate.
     * It will be shown in case the connection is interrupted.
     */
    useConnectivityInfoLabel: boolean;

    /**
     * The z-order of the {@link Video} of {@link ParticipantView} in the
     * stacking space of all {@code Video}s. For more details, refer to the
     * {@code zOrder} property of the {@code Video} class for React Native.
     */
    zOrder: number;

    /**
     * Indicates whether zooming (pinch to zoom and/or drag) is enabled.
     */
    zoomEnabled: boolean;
}

/**
 * Implements a React Component which depicts a specific participant's avatar
 * and video.
 *
 * @augments Component
 */
class ParticipantView extends Component<IProps> {
    _waveBars = [
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0)
    ];

    _waveLoops: Animated.CompositeAnimation[] = [];

    override componentDidMount() {
        this._updateSpeakerPulseAnimation();
    }

    override componentDidUpdate(prevProps: IProps) {
        if (prevProps._isDominantSpeaker !== this.props._isDominantSpeaker
            || prevProps._isAudioMuted !== this.props._isAudioMuted
            || prevProps._isOnHold !== this.props._isOnHold
            || prevProps._renderVideo !== this.props._renderVideo
            || prevProps._isSharedVideoParticipant !== this.props._isSharedVideoParticipant) {
            this._updateSpeakerPulseAnimation();
        }
    }

    override componentWillUnmount() {
        this._stopSpeakerPulseAnimation();
    }

    _updateSpeakerPulseAnimation() {
        if (this._shouldAnimateSpeakerPulse()) {
            if (this._waveLoops.length === 0) {
                this._waveLoops = this._waveBars.map((bar, idx) =>
                    Animated.loop(
                        Animated.sequence([
                            Animated.delay(idx * 85),
                            Animated.timing(bar, {
                                duration: 280 + ((idx % 4) * 55),
                                easing: Easing.inOut(Easing.sin),
                                toValue: 1,
                                useNativeDriver: false
                            }),
                            Animated.timing(bar, {
                                duration: 340 + ((idx % 3) * 45),
                                easing: Easing.inOut(Easing.sin),
                                toValue: 0,
                                useNativeDriver: false
                            })
                        ])
                    ));
                this._waveLoops.forEach(loop => loop.start());
            }
        } else {
            this._stopSpeakerPulseAnimation();
        }
    }

    _stopSpeakerPulseAnimation() {
        this._waveLoops.forEach(loop => loop.stop());
        this._waveLoops = [];
        this._waveBars.forEach(bar => bar.setValue(0));
    }

    _shouldAnimateSpeakerPulse() {
        const {
            _audioTrack,
            _isAudioMuted,
            _isOnHold,
            _isSharedVideoParticipant,
            _renderVideo
        } = this.props;
        const isTrackMuted = _audioTrack?.muted ?? _isAudioMuted;

        return !isTrackMuted
            && !_isOnHold
            && !_renderVideo
            && !_isSharedVideoParticipant;
    }

    _shouldShowSpeakerWave() {
        const {
            _isSharedVideoParticipant,
            _renderVideo,
            showSpeakerWave = false
        } = this.props;

        return showSpeakerWave && !_renderVideo && !_isSharedVideoParticipant;
    }

    _renderWaveContainerStyle(visualAvatarSize: number): ViewStyle[] {
        const barWidth = Math.max(3, Math.round(visualAvatarSize * 0.04));
        const barGap = Math.max(3, Math.round(visualAvatarSize * 0.02));
        const containerPadding = Math.max(6, Math.round(visualAvatarSize * 0.06));
        const waveContainerHeight = Math.max(20, Math.round(visualAvatarSize * 0.2));
        const waveContainerWidth
            = (barWidth * this._waveBars.length) + (barGap * (this._waveBars.length - 1)) + (containerPadding * 2);

        return [
            styles.speakerWaveContainer as ViewStyle,
            {
                height: waveContainerHeight,
                paddingHorizontal: containerPadding,
                width: waveContainerWidth
            } as ViewStyle
        ];
    }

    _renderAvatarWithSpeakerWave() {
        const {
            _audioTrack,
            _isAudioMuted,
            _isDominantSpeaker,
            _isLocal,
            _isOnHold,
            _renderVideo,
            avatarSize
        } = this.props;
        const showWave = this._shouldShowSpeakerWave();
        const isTrackMuted = _audioTrack?.muted ?? _isAudioMuted;
        const shouldDisplayWave = showWave && !isTrackMuted && !_isOnHold;
        const animateWave = this._shouldAnimateSpeakerPulse();
        const visualAvatarSize = !_isLocal && !_renderVideo
            ? Math.round(avatarSize * 1)
            : avatarSize;

        if (!showWave) {
            return (
                <View style = { styles.avatarContainer as ViewStyle }>
                    <Avatar
                        participantId = { this.props.participantId }
                        size = { visualAvatarSize } />
                </View>
            );
        }

        const shellSize = Math.round(visualAvatarSize * 1.5);
        const barBaseHeight = Math.max(3, Math.round(visualAvatarSize * 0.03));
        const barWidth = Math.max(3, Math.round(visualAvatarSize * 0.04));
        const barGap = Math.max(3, Math.round(visualAvatarSize * 0.02));
        const midBarIndex = (this._waveBars.length - 1) / 2;

        const barMaxHeights = this._waveBars.map((_, idx) => {
            const distanceFromCenter = Math.abs(idx - midBarIndex);
            const centerWeight = 1 - (distanceFromCenter / (midBarIndex + 1));

            return Math.max(barBaseHeight + 4, Math.round(visualAvatarSize * (0.08 + centerWeight * 0.14)));
        });

        return (
            <View style = { styles.avatarContainer as ViewStyle }>
                <View
                    style = { [
                        styles.avatarShell,
                        {
                            borderRadius: shellSize / 2,
                            height: shellSize,
                            width: shellSize
                        }
                    ] as any[] }>
                    <View style = { _isDominantSpeaker ? styles.avatarGlow as ViewStyle : undefined }>
                        <Avatar
                            participantId = { this.props.participantId }
                            size = { visualAvatarSize } />
                    </View>
                </View>
                { shouldDisplayWave
                    ? this._renderWaveBars(
                        visualAvatarSize,
                        barBaseHeight,
                        barWidth,
                        barGap,
                        barMaxHeights,
                        animateWave
                    )
                    : null }
            </View>
        );
    }

    _renderWaveBars(
            visualAvatarSize: number,
            barBaseHeight: number,
            barWidth: number,
            barGap: number,
            barMaxHeights: number[],
            animateWave: boolean) {
        const waveStyles = this._renderWaveContainerStyle(visualAvatarSize);

        return (
            <View style = { waveStyles as any[] }>
                { this._waveBars.map((bar, idx) => (
                    <Animated.View
                        key = { `wave-bar-${idx}` }
                        style = { [
                            styles.speakerWaveBar,
                            {
                                marginHorizontal: barGap / 2,
                                width: barWidth
                            },
                            animateWave
                                ? {
                                    height: bar.interpolate({
                                        inputRange: [ 0, 1 ],
                                        outputRange: [ barBaseHeight, barMaxHeights[idx] ]
                                    }),
                                    opacity: bar.interpolate({
                                        inputRange: [ 0, 1 ],
                                        outputRange: [ 0.42, 1 ]
                                    })
                                }
                                : {
                                    height: barBaseHeight,
                                    opacity: 0.34
                                }
                        ] as any[] } />
                )) }
            </View>
        );
    }

    /**
     * Renders the inactive connection status label.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderInactiveConnectionInfo() {
        const {
            avatarSize,
            _participantName: displayName,
            _isConnectionInterrupted,
            t
        } = this.props;

        // XXX Consider splitting this component into 2: one for the large view
        // and one for the thumbnail. Some of these don't apply to both.
        const containerStyle = {
            ...styles.connectionInfoContainer,
            width: avatarSize * 1.5
        };

        return (
            <View
                pointerEvents = 'box-none'
                style = { containerStyle as ViewStyle }>
                <Text style = { styles.connectionInfoText as TextStyle }>
                    { _isConnectionInterrupted
                        ? t('presenceStatus.connecting')
                        : t('connection.LOW_BANDWIDTH', { displayName }) }
                </Text>
            </View>
        );
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        const {
            _isConnectionInactive,
            _isConnectionInterrupted,
            _isOnHold,
            _isSharedVideoParticipant,
            _isS2SV2Translating,
            _isVoiceTranslationActive,
            _renderVideo: renderVideo,
            _sharedVideoEnabled,
            _videoTrack: videoTrack,
            disableVideo,
            onPress
        } = this.props;

        const testHintId
            = this.props.testHintId
                ? this.props.testHintId
                : `org.jitsi.meet.Participant#${this.props.participantId}`;

        const renderSharedVideo = _isSharedVideoParticipant && !disableVideo && _sharedVideoEnabled;
        const isAvatarOnly = !renderSharedVideo && !renderVideo;
        const audioIndicatorContainerStyle = this.props.audioIndicatorStyle
            ?? (isAvatarOnly
                ? {
                    ...styles.audioIndicatorStyleBelowAvatar,
                    transform: [{ translateY: this.props.avatarSize / 2 + 6 }, { scale: 0.4 }]
                }
                : styles.audioIndicatorStyleSmall);
        const isLargeVideo = this.props.testHintId === 'org.jitsi.meet.LargeVideo';
        const isTileStatus = Boolean(this.props.showStatusLabel) && !isLargeVideo;
        const objectFit = _isVoiceTranslationActive
            ? 'contain'
            : (isLargeVideo ? 'cover' : (this.props.showStatusLabel ? 'cover' : undefined));
        const shouldShowAudioIndicator = (this.props.showAudioIndicator ?? true)
            && !(isLargeVideo && renderVideo);
        const shouldShowStatusLabels = isLargeVideo
            && !_isSharedVideoParticipant
            && (_isOnHold || _isS2SV2Translating);
        const statusLabels: Array<string> = [];

        if (_isOnHold) {
            statusLabels.push(this.props.t('videothumbnail.onHold'));
        }

        if (_isS2SV2Translating) {
            statusLabels.push(this.props.t('s2sV2.panel.translating'));
        }

        const statusLabelsView = shouldShowStatusLabels
            ? (
                <View
                    pointerEvents='none'
                    style={(isAvatarOnly
                        ? (isTileStatus ? styles.statusLabelsAboveAvatarSmall : styles.statusLabelsAboveAvatar)
                        : (isTileStatus ? styles.statusLabelsOnThumbnail : styles.statusLabelsOnLargeVideo)) as ViewStyle}>
                    {statusLabels.map(label => (
                        <View
                            key={label}
                            style={(
                                label === this.props.t('s2sV2.panel.translating')
                                    ? (isTileStatus ? styles.statusLabelPillTranslatingSmall : styles.statusLabelPillTranslating)
                                    : (isTileStatus ? styles.statusLabelPillSmall : styles.statusLabelPill)
                            ) as ViewStyle}>
                            <Text
                                style={(isTileStatus ? styles.statusLabelTextSmall : styles.statusLabelText) as TextStyle}>
                                {label}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null;

        return (
            <Container
                onClick={renderVideo || renderSharedVideo ? undefined : onPress}
                style={{
                    ...styles.participantView,
                    ...this.props.style
                }}
                touchFeedback={false}>

                <TestHint
                    id={testHintId}
                    onPress={renderSharedVideo ? undefined : onPress}
                    value='' />

                {renderSharedVideo && <SharedVideo />}

                {renderVideo
                    && <VideoTrack
                        borderRadius = { this.props.videoBorderRadius }
                        objectFit = { objectFit }
                        onPress={onPress}
                        videoTrack={videoTrack}
                        waitForVideoStarted={false}
                        zOrder={this.props.zOrder}
                        zoomEnabled={this.props.zoomEnabled} />}

                {!isAvatarOnly && statusLabelsView}

                {!renderSharedVideo && !renderVideo
                    && <>

                        {statusLabelsView}

                        {this._renderAvatarWithSpeakerWave()}
                        {!this._shouldShowSpeakerWave() && shouldShowAudioIndicator && (
                            <ThumbnailAudioIndicator
                                _audioTrack = { this.props._audioTrack }
                                containerStyle = {{
                                    ...audioIndicatorContainerStyle,
                                    marginTop: this.props.avatarSize * 0.6
                                } as ViewStyle}
                            />
                        )}
                    </>}




                {(_isConnectionInactive || _isConnectionInterrupted) && this.props.useConnectivityInfoLabel
                    && this._renderInactiveConnectionInfo()}
            </Container>
        );
    }
}

/**
 * Maps (parts of) the redux state to the associated {@link ParticipantView}'s
 * props.
 *
 * @param {Object} state - The redux state.
 * @param {Object} ownProps - The React {@code Component} props passed to the
 * associated (instance of) {@code ParticipantView}.
 * @private
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    const { disableVideo, participantId } = ownProps;
    const participant = getParticipantById(state, participantId);
    const videoTrack = getVideoTrackByParticipant(state, participant);
    const audioTrack = getTrackByMediaTypeAndParticipant(
        state['features/base/tracks'],
        MEDIA_TYPE.AUDIO,
        participant?.id
    );

    return {
        _audioTrack: audioTrack,
        _isAudioMuted: participant ? isParticipantAudioMuted(participant, state) : true,
        _isConnectionInactive: isTrackStreamingStatusInactive(videoTrack),
        _isConnectionInterrupted: isTrackStreamingStatusInterrupted(videoTrack),
        _isDominantSpeaker: Boolean(participant?.dominantSpeaker),
        _isLocal: Boolean(participant?.local),
        _isOnHold: Boolean(participant?.isSilent),
        _isSharedVideoParticipant: isSharedVideoParticipant(participant),
        _isS2SV2Translating: isS2SV2ParticipantTranslating(state, participantId),
        _isVoiceTranslationActive: isS2SV2Active(state) || isVoiceTranslationEnabled(state),
        _participantName: getParticipantDisplayName(state, participantId),
        _renderVideo: shouldRenderParticipantVideo(state, participantId) && !disableVideo,
        _sharedVideoEnabled: isSharedVideoEnabled(state),
        _videoTrack: videoTrack
    };
}

/**
 * Returns true if the video of the participant should be rendered.
 *
 * @param {Object|Function} stateful - Object or function that can be resolved
 * to the Redux state.
 * @param {string} id - The ID of the participant.
 * @returns {boolean}
 */
function shouldRenderParticipantVideo(stateful: IStateful, id: string) {
    const state = toState(stateful);
    const participant = getParticipantById(state, id);

    if (!participant) {
        return false;
    }

    /* First check if we have an unmuted video track. */
    const videoTrack = getVideoTrackByParticipant(state, participant);

    if (!videoTrack) {
        return false;
    }

    if (!shouldRenderVideoTrack(videoTrack, /* waitForVideoStarted */ false)) {
        return false;
    }

    /* Then check if the participant connection or track streaming status is active. */
    if (!videoTrack.local && !isTrackStreamingStatusActive(videoTrack)) {
        return false;
    }

    return true;
}

export default translate(connect(_mapStateToProps)(ParticipantView));
