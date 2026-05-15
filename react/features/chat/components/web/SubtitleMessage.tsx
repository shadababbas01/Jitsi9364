import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { keyframes } from 'tss-react';
import { makeStyles } from 'tss-react/mui';

import { IReduxState } from '../../../app/types';
import { getParticipantDisplayName } from '../../../base/participants/functions';
import { normalizeSubtitlesLanguage, translateLiveCaptionText } from '../../../subtitles/languages';
import { ISubtitle } from '../../../subtitles/types';

/**
 * Props for the SubtitleMessage component.
 */
interface IProps extends ISubtitle {

    /**
     * Whether to show the display name of the participant.
     */
    showDisplayName: boolean;
}

const typingBounce = keyframes`
    0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.4;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
`;

/**
 * The styles for the SubtitleMessage component.
 */
const useStyles = makeStyles()(theme => {
    return {
        messageContainer: {
            backgroundColor: theme.palette.ui02,
            borderRadius: '4px 12px 12px 12px',
            padding: '12px',
            maxWidth: '100%',
            marginTop: '4px',
            boxSizing: 'border-box',
            display: 'inline-flex'
        },

        messageContent: {
            maxWidth: '100%',
            overflow: 'hidden',
            flex: 1
        },

        messageHeader: {
            ...theme.typography.labelBold,
            color: theme.palette.text02,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            marginBottom: theme.spacing(1),
            maxWidth: '130px'
        },

        messageText: {
            ...theme.typography.bodyShortRegular,
            color: theme.palette.text01,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
        },

        timestamp: {
            ...theme.typography.labelRegular,
            color: theme.palette.text03,
            marginTop: theme.spacing(1)
        },

        typingDots: {
            alignItems: 'center',
            display: 'inline-flex',
            gap: '4px',
            padding: '4px 0'
        },

        typingDot: {
            animation: `${typingBounce} 1.4s ease-in-out infinite`,
            backgroundColor: theme.palette.text03,
            borderRadius: '50%',
            height: '7px',
            width: '7px',

            '&:nth-of-type(2)': {
                animationDelay: '0.2s'
            },

            '&:nth-of-type(3)': {
                animationDelay: '0.4s'
            }
        }
    };
});

/**
 * Component that renders a single subtitle message with the participant's name,
 * message content, and timestamp.
 *
 * @param {IProps} props - The component props.
 * @returns {JSX.Element} - The rendered subtitle message.
 */
export default function SubtitleMessage({
    id,
    isTranscription,
    language,
    participantId,
    participantName,
    text,
    timestamp,
    interim,
    showDisplayName
}: IProps) {
    const { classes } = useStyles();
    const participantNameFromState = useSelector((state: any) =>
        getParticipantDisplayName(state, participantId));
    const displayName = participantNameFromState || participantName;
    const selectedLanguage = useSelector((state: IReduxState) =>
        normalizeSubtitlesLanguage(state['features/subtitles']._language));
    const jwt = useSelector((state: IReduxState) => state['features/base/jwt'].jwt);
    const [ displayText, setDisplayText ] = useState(text);
    const requestId = useRef(0);

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

    return (
        <div className = { classes.messageContainer }>
            <div className = { classes.messageContent }>
                {showDisplayName && (
                    <div className = { classes.messageHeader }>
                        {displayName}
                    </div>
                )}
                {interim ? (
                    <div className = { classes.typingDots }>
                        <span className = { classes.typingDot } />
                        <span className = { classes.typingDot } />
                        <span className = { classes.typingDot } />
                    </div>
                ) : (
                    <>
                        <div className = { classes.messageText }>{displayText}</div>
                        <div className = { classes.timestamp }>
                            {new Date(timestamp).toLocaleTimeString()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
