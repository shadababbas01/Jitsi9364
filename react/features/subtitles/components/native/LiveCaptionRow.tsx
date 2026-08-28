import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Avatar from '../../../base/avatar/components/Avatar';
import { getLocalParticipant } from '../../../base/participants/functions';
import { S2SV2Theme } from '../../../s2s-v2/components/native/palettes';
import getS2SV2PanelStyles from '../../../s2s-v2/components/native/panelStyles';
import { getSubtitleTranslationTarget, translateLiveCaptionTextCached } from '../../languages';
import { ISubtitle } from '../../types';

/**
 * How big the speaker's picture is drawn, sized to sit on one line with their name and the time.
 */
const SPEAKER_AVATAR_SIZE = 24;

interface IProps {

    /**
     * Whether this is the top one, which has nothing above it to be separated from.
     */
    first: boolean;

    /**
     * Whether this line is currently being read aloud.
     */
    speaking: boolean;

    /**
     * The caption to show.
     */
    subtitle: ISubtitle;

    /**
     * The language to read in, for a caption which has not recorded one of its own.
     *
     * Only a fallback. A caption freezes the language it was finalized for when it arrives, and that is what is used
     * whenever it is there: changing language applies to what is said next, never to what is already on screen.
     */
    targetLanguage?: string | null;

    /**
     * Which of the two ways the panel is drawn.
     */
    theme: S2SV2Theme;
}

/**
 * When a caption was said, as a clock would show it.
 *
 * @param {number} timestamp - When it was said, by the speaker's clock.
 * @returns {string}
 */
function _time(timestamp: number): string {
    const at = new Date(timestamp);
    const hours = at.getHours();

    return `${hours % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * One caption in the transcript: who said it, when, what they said, and what it means.
 *
 * Drawn from the s2s-v2 panel's own styles rather than from a copy of them, so the two panels are the same panel with
 * different contents in it and cannot drift apart a rule at a time.
 *
 * Both lines are always shown and neither can be hidden. What was said is the record and what it means is what the
 * reader is acting on, so somebody who wants to check one against the other should not have to ask for it.
 *
 * The translation is fetched here rather than arriving with the caption, because it is the one thing on this panel
 * which is nobody else's business: every device reads in whichever language its own user chose, so translating on the
 * device which is doing the reading costs one message on the wire and one translation per reader, instead of one
 * message per reader.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function LiveCaptionRow({ first, speaking, subtitle, targetLanguage, theme }: IProps) {
    const { t } = useTranslation();
    const styles = getS2SV2PanelStyles(theme);
    const jwt = useSelector((state: IReduxState) => state['features/base/jwt'].jwt);
    const localId = useSelector((state: IReduxState) => getLocalParticipant(state)?.id);

    // Somebody reading a transcript of a conversation they were in is looking for their own lines in it, and a name
    // is a slower thing to find than the word for oneself. The avatar is still drawn from the real name, so the
    // initials stay the ones this participant is recognised by everywhere else in the meeting.
    const isLocal = Boolean(localId) && subtitle.participantId === localId;
    const speakerName = isLocal ? t('liveCaptionsPanel.you') : subtitle.participantName;
    const [ translated, setTranslated ] = useState<string | undefined>();
    const [ pending, setPending ] = useState(false);
    const request = useRef(0);

    // The caption's own language wins over whatever the panel is set to now. Depended on rather than the live value,
    // so that changing language does not re-run this for every line already in the transcript.
    const readLanguage = subtitle.readLanguage ?? targetLanguage;

    useEffect(() => {
        const translateTo = getSubtitleTranslationTarget(subtitle, readLanguage);
        const current = ++request.current;

        setTranslated(undefined);

        // Already in the language this reader asked for. Nothing to translate, and nothing to wait for underneath it.
        if (!translateTo) {
            setPending(false);

            return;
        }

        setPending(true);

        let cancelled = false;

        translateLiveCaptionTextCached(subtitle.id, subtitle.text, translateTo, jwt)
            .then(text => {
                if (cancelled || request.current !== current) {
                    return;
                }

                // The service answering with the words it was given is not a translation, and showing it would print
                // the same sentence twice.
                if (text && text !== subtitle.text) {
                    setTranslated(text);
                }
            })
            .catch(() => {
                // Leaving the translation out is better than showing the untranslated text twice.
            })
            .finally(() => {
                if (!cancelled && request.current === current) {
                    setPending(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [ jwt, readLanguage, subtitle ]);

    return (
        <View
            style = { [
                styles.transcriptEntry,
                first && styles.transcriptEntryFirst,
                (pending || speaking) && styles.transcriptEntryPending
            ] as ViewStyle[] }>
            <View style = { styles.transcriptMeta as ViewStyle }>
                <View style = { styles.transcriptAvatar as ViewStyle }>
                    <Avatar
                        displayName = { subtitle.participantName }
                        participantId = { subtitle.participantId }
                        size = { SPEAKER_AVATAR_SIZE } />
                </View>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.transcriptSpeaker as TextStyle }>
                    { speakerName }
                </Text>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.transcriptTime as TextStyle }>
                    { _time(subtitle.timestamp) }
                </Text>
            </View>

            <Text style = { styles.transcriptOriginal as TextStyle }>
                { subtitle.text }
            </Text>

            { translated ? (
                <Text style = { styles.transcriptTranslated as TextStyle }>
                    { translated }
                </Text>
            ) : pending && (
                <Text style = { styles.transcriptTranslating as TextStyle }>
                    { t('s2sV2.panel.translating') }
                </Text>
            ) }
        </View>
    );
}
