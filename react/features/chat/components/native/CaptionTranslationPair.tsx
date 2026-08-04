import React, { useEffect, useRef, useState } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { getSpeakingCaptionId } from '../../../caption-tts/functions.native';
import { getSubtitleTranslationTarget, translateLiveCaptionTextCached } from '../../../subtitles/languages';
import { ISubtitle } from '../../../subtitles/types';

import SpeakingWaveform from './SpeakingWaveform';
import { captionsPanelStyles } from './styles';

interface IProps {

    /**
     * The caption as it was transcribed.
     */
    subtitle: ISubtitle;

    /**
     * The language the caption should be translated into.
     */
    targetLanguage?: string | null;

    /**
     * A translation which already arrived from the transcriber, saving a client side one.
     */
    translation?: string;
}

/**
 * A caption shown as the pair the design asks for: what was said on top, and what it means in the chosen language
 * underneath.
 *
 * The translation comes from the transcriber when it sent one, and is otherwise fetched through the shared cache, so a
 * caption is translated once no matter how many places show or speak it.
 *
 * @param {IProps} props - The component props.
 * @returns {JSX.Element}
 */
export default function CaptionTranslationPair({ subtitle, targetLanguage, translation }: IProps) {
    const jwt = useSelector((state: IReduxState) => state['features/base/jwt'].jwt);
    const isSpeaking = useSelector(getSpeakingCaptionId) === subtitle.id;
    const [ translatedText, setTranslatedText ] = useState(translation);
    const requestId = useRef(0);

    useEffect(() => {
        const translateTo = getSubtitleTranslationTarget(subtitle, targetLanguage);
        const currentRequestId = ++requestId.current;

        setTranslatedText(translation);

        if (translation || !translateTo) {
            return;
        }

        let cancelled = false;

        translateLiveCaptionTextCached(subtitle.id, subtitle.text, translateTo, jwt)
            .then(text => {
                if (!cancelled && requestId.current === currentRequestId && text !== subtitle.text) {
                    setTranslatedText(text);
                }
            })
            .catch(() => {
                // Leaving the translation out is better than showing the untranslated text twice.
            });

        return () => {
            cancelled = true;
        };
    }, [ jwt, subtitle, targetLanguage, translation ]);

    return (
        <View style = { captionsPanelStyles.pair as ViewStyle }>
            <View style = { captionsPanelStyles.sourceCard as ViewStyle }>
                <Text style = { captionsPanelStyles.sourceText }>
                    { subtitle.text }
                </Text>
                { isSpeaking && <SpeakingWaveform /> }
            </View>
            {
                Boolean(translatedText) && (
                    <View style = { captionsPanelStyles.translationCard as ViewStyle }>
                        <Text style = { captionsPanelStyles.translationText }>
                            { translatedText }
                        </Text>
                    </View>
                )
            }
        </View>
    );
}
