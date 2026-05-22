import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getParticipantDisplayName } from '../../../base/participants/functions';
import { normalizeSubtitlesLanguage, translateLiveCaptionText } from '../../../subtitles/languages';
import { ISubtitle } from '../../../subtitles/types';

import { closedCaptionsStyles } from './styles';


interface IProps extends ISubtitle {
    showDisplayName: boolean;
}

export default function SubtitleMessage({
    id,
    isTranscription,
    language,
    participantId,
    participantName: subtitleParticipantName,
    text,
    timestamp,
    interim,
    showDisplayName
}: IProps) {
    const participantNameFromState = useSelector((state: IReduxState) =>
        getParticipantDisplayName(state, participantId));
    const displayName = participantNameFromState || subtitleParticipantName;
    const selectedLanguage = useSelector((state: IReduxState) =>
        normalizeSubtitlesLanguage(state['features/subtitles']._language));
    const jwt = useSelector((state: IReduxState) => state['features/base/jwt'].jwt);
    const [ displayText, setDisplayText ] = useState(text);
    const requestId = useRef(0);
    const dotAnimations = useRef([ 0, 1, 2 ].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const targetLanguage = normalizeSubtitlesLanguage(selectedLanguage);
        const messageLanguage = normalizeSubtitlesLanguage(language);
        const currentRequestId = ++requestId.current;

        setDisplayText(text);

        if (
            interim
            || !text
            || !targetLanguage
            || targetLanguage.toLowerCase().startsWith('en')
            || (!isTranscription && messageLanguage?.toLowerCase() === targetLanguage.toLowerCase())
        ) {
            return;
        }

        let cancelled = false;

        translateLiveCaptionText(text, targetLanguage, jwt)
            .then(translatedText => {
                if (!cancelled && requestId.current === currentRequestId) {
                    setDisplayText(translatedText);
                }
            })
            .catch(() => {
                if (!cancelled && requestId.current === currentRequestId) {
                    setDisplayText(text);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [ id, interim, isTranscription, jwt, language, selectedLanguage, text ]);

    useEffect(() => {
        if (!interim) {
            return;
        }

        const animation = Animated.loop(Animated.stagger(180, dotAnimations.map(dot =>
            Animated.sequence([
                Animated.timing(dot, {
                    duration: 320,
                    toValue: 1,
                    useNativeDriver: true
                }),
                Animated.timing(dot, {
                    duration: 320,
                    toValue: 0,
                    useNativeDriver: true
                })
            ])
        )));

        animation.start();

        return () => animation.stop();
    }, [ dotAnimations, interim ]);

    return (
        <View style = { closedCaptionsStyles.subtitleMessageContainer as ViewStyle }>
            <View style = { closedCaptionsStyles.subtitleMessageContent as ViewStyle }>
                {
                    showDisplayName && (
                        <Text style = { closedCaptionsStyles.subtitleMessageHeader }>
                            { displayName }
                        </Text>
                    )
                }
                {
                    interim ? (
                        <View style = { closedCaptionsStyles.typingDots as ViewStyle }>
                            {
                                dotAnimations.map((dot, index) => (
                                    <Animated.View
                                        key = { index }
                                        style = { [
                                            closedCaptionsStyles.typingDot,
                                            {
                                                opacity: dot.interpolate({
                                                    inputRange: [ 0, 1 ],
                                                    outputRange: [ 0.4, 1 ]
                                                }),
                                                transform: [ {
                                                    scale: dot.interpolate({
                                                        inputRange: [ 0, 1 ],
                                                        outputRange: [ 0, 1 ]
                                                    })
                                                } ]
                                            }
                                        ] } />
                                ))
                            }
                        </View>
                    ) : (
                        <>
                            <Text style = { closedCaptionsStyles.subtitleMessageText }>{ displayText }</Text>
                            <Text style = { closedCaptionsStyles.subtitleMessageTimestamp }>
                                { new Date(timestamp).toLocaleTimeString() }
                            </Text>
                        </>
                    )
                }
            </View>
        </View>
    );
}
