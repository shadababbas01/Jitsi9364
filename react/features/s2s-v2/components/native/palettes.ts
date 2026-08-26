import BaseTheme from '../../../base/ui/components/BaseTheme.native';

/**
 * Which of the two ways the panel can be drawn.
 *
 * A local preference like the language and the suppression, and for the same reason: what one listener has on their own
 * screen is nobody else's business, and nothing about it goes anywhere near the wire.
 */
export type S2SV2Theme = 'dark' | 'light';

/**
 * The colours one way of drawing the panel is made of.
 */
export interface IS2SV2Palette {

    /**
     * The colour a chosen thing is marked in.
     */
    accent: string;

    /**
     * Behind the panel itself.
     */
    background: string;

    /**
     * Behind the small language tag on an utterance.
     */
    badge: string;

    /**
     * Behind the things which sit on the panel: the transcript, and each of the two controls.
     */
    card: string;

    /**
     * What the one action which takes something away from everybody else is drawn in.
     */
    danger: string;

    /**
     * The line between one utterance and the next.
     */
    divider: string;

    /**
     * What a session in progress is marked in.
     */
    live: string;

    /**
     * Behind whichever half of the theme control is not chosen.
     */
    segment: string;

    /**
     * What is being read.
     */
    text: string;

    /**
     * What is worth reading second: a timestamp, a helper line, the translation under the words.
     */
    textMuted: string;
}

/**
 * The dark panel, which is how the rest of the meeting is drawn and so is what the panel starts as.
 */
const DARK: IS2SV2Palette = {
    accent: BaseTheme.palette.action01,
    background: BaseTheme.palette.ui01,
    badge: BaseTheme.palette.ui03,
    card: BaseTheme.palette.ui02,
    danger: '#F0655B',
    divider: BaseTheme.palette.ui04,
    live: '#16A34A',
    segment: BaseTheme.palette.ui03,
    text: BaseTheme.palette.text01,
    textMuted: BaseTheme.palette.text02
};

/**
 * The light panel.
 *
 * Written out rather than derived from the dark one, because a palette which is the inverse of another is not the same
 * thing as one which can be read: the muted text in particular has to be darkened much further than inverting would
 * take it before it holds its contrast against a white card.
 */
const LIGHT: IS2SV2Palette = {
    accent: '#1B6FE0',
    background: '#F4F4F7',
    badge: '#E2E2EA',
    card: '#FFFFFF',
    danger: '#C0362C',
    divider: '#DCDCE4',
    live: '#137A3C',
    segment: '#E2E2EA',
    text: '#14141A',
    textMuted: '#5B5B69'
};

const PALETTES: { [theme in S2SV2Theme]: IS2SV2Palette; } = {
    dark: DARK,
    light: LIGHT
};

/**
 * Returns the colours the panel is drawn in.
 *
 * @param {S2SV2Theme} theme - Which of the two.
 * @returns {IS2SV2Palette}
 */
export function getS2SV2Palette(theme: S2SV2Theme): IS2SV2Palette {
    return PALETTES[theme] ?? DARK;
}
