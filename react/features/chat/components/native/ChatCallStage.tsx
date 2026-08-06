/* eslint-disable react/no-multi-comp */

import React, { useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Avatar from '../../../base/avatar/components/Avatar';
import { getLocalParticipant, getRemoteParticipants } from '../../../base/participants/functions';
import { getChatTtsSpeakerId } from '../../../caption-tts/functions.native';

import { ChatCallContext } from './ChatCallContext';
import { chatCallStyles as styles } from './styles';

/**
 * How many avatars fit on the stage before the rest are counted off to one side.
 */
const MAX_AVATARS = 6;

/**
 * An avatar which shows whether that participant is the one talking. Speech is rings pushed out from behind the avatar,
 * so that a participant being read aloud looks like a participant speaking on a call.
 *
 * @param {Object} props - The props of the component.
 * @returns {JSX.Element}
 */
function SpeakingAvatar({ displayName, isLocal, participantId, speaking }: {
    displayName: string;
    isLocal?: boolean;
    participantId: string;
    speaking: boolean;
}) {
    const { t } = useTranslation();

    // Two rings, half a cycle apart, so they leave the avatar one after the other rather than together.
    const rings = useMemo(() => [ new Animated.Value(0), new Animated.Value(0) ], []);

    useEffect(() => {
        if (!speaking) {
            rings.forEach(ring => ring.setValue(0));

            return;
        }

        const animations = rings.map(ring => Animated.loop(Animated.timing(ring, {
            duration: 1600,
            easing: Easing.out(Easing.ease),
            toValue: 1,
            useNativeDriver: true
        })));

        animations.forEach((animation, index) => setTimeout(() => animation.start(), index * 800));

        return () => animations.forEach(animation => animation.stop());
    }, [ rings, speaking ]);

    return (
        <View style = { styles.avatarSlot as ViewStyle }>
            <View style = { styles.avatarStack as ViewStyle }>
                { speaking && rings.map((ring, index) => (
                    <Animated.View
                        key = { index }
                        pointerEvents = 'none'
                        style = { [
                            styles.speakingRing,
                            {
                                opacity: ring.interpolate({
                                    inputRange: [ 0, 1 ],
                                    outputRange: [ 0.55, 0 ]
                                }),
                                transform: [ {
                                    scale: ring.interpolate({
                                        inputRange: [ 0, 1 ],
                                        outputRange: [ 1, 1.7 ]
                                    })
                                } ]
                            }
                        ] as ViewStyle[] } />
                )) }
                <View
                    style = { [
                        styles.avatarRim,
                        speaking && styles.avatarRimSpeaking
                    ] as ViewStyle[] }>
                    <Avatar
                        displayName = { displayName }
                        participantId = { participantId }
                        size = { 64 } />
                </View>
            </View>
            <Text
                numberOfLines = { 1 }
                style = { [
                    styles.avatarName,
                    speaking && styles.avatarNameSpeaking
                ] as TextStyle[] }>
                { isLocal ? t('chat.you') : displayName }
            </Text>
        </View>
    );
}

/**
 * The stage of the live translation call: who is on the call, and who is talking. Nothing anybody says is written out -
 * messages are read aloud by the caption-tts chat middleware, and this shows whose voice is being heard.
 *
 * @returns {JSX.Element}
 */
export default function ChatCallStage() {
    const { t } = useTranslation();
    const { dictating } = useContext(ChatCallContext);
    const speakerId = useSelector((state: IReduxState) => getChatTtsSpeakerId(state));
    const localParticipant = useSelector((state: IReduxState) => getLocalParticipant(state));
    const remoteParticipants = useSelector((state: IReduxState) => getRemoteParticipants(state));
    const { defaultLocalDisplayName, defaultRemoteDisplayName }
        = useSelector((state: IReduxState) => state['features/base/config']);

    const remotes = useMemo(
        () => Array.from(remoteParticipants.values()).filter(participant => !participant.fakeParticipant),
        [ remoteParticipants ]);
    const shown = remotes.slice(0, MAX_AVATARS - 1);
    const hidden = remotes.length - shown.length;

    // Names are resolved here rather than through a selector returning an object: a fresh object on every store change
    // would re-render the stage for every action in the meeting.
    const nameOf = (participant?: { local?: boolean; name?: string; }) => participant?.name
        || (participant?.local ? defaultLocalDisplayName : defaultRemoteDisplayName)
        || '';

    const speakingName = speakerId ? nameOf(remoteParticipants.get(speakerId)) : undefined;
    let statusKey = 'chat.call.waiting';

    if (dictating) {
        statusKey = 'chat.call.youAreSpeaking';
    } else if (speakingName) {
        statusKey = 'chat.call.someoneIsSpeaking';
    }

    return (
        <View style = { styles.stage as ViewStyle }>
            <View style = { styles.avatarRow as ViewStyle }>
                { localParticipant && (
                    <SpeakingAvatar
                        displayName = { nameOf(localParticipant) }
                        isLocal = { true }
                        participantId = { localParticipant.id }
                        speaking = { dictating } />
                ) }
                { shown.map(participant => (
                    <SpeakingAvatar
                        displayName = { nameOf(participant) }
                        key = { participant.id }
                        participantId = { participant.id }
                        speaking = { participant.id === speakerId } />
                )) }
                { hidden > 0 && (
                    <View style = { styles.avatarSlot as ViewStyle }>
                        <View style = { styles.avatarOverflow as ViewStyle }>
                            <Text style = { styles.avatarOverflowText as TextStyle }>
                                +{ hidden }
                            </Text>
                        </View>
                    </View>
                ) }
            </View>

            <Text style = { styles.stageStatus as TextStyle }>
                { t(statusKey, { name: speakingName }) }
            </Text>
        </View>
    );
}
