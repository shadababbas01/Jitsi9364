import BaseTheme from '../../../base/ui/components/BaseTheme.native';

import { IS2SV2Palette, S2SV2Theme, getS2SV2Palette } from './palettes';

/**
 * The panel drawn in one set of colours.
 *
 * Worked out once per theme and kept, rather than on every render: there are two of them, they never change, and a
 * transcript which grows by a line a second would otherwise rebuild every style in the panel each time it did.
 */
const cache = new Map<S2SV2Theme, ReturnType<typeof _create>>();

/**
 * Builds the panel's styles out of one palette.
 *
 * @param {IS2SV2Palette} palette - The colours to draw it in.
 * @returns {Object}
 */
function _create(palette: IS2SV2Palette) {
    return {

        // The panel sits under the video, in the room the tile grid gives up for it, rather than floating over it.
        panel: {
            backgroundColor: palette.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            bottom: 0,
            left: 0,
            paddingBottom: BaseTheme.spacing[3],
            paddingHorizontal: BaseTheme.spacing[3],
            position: 'absolute' as const,
            right: 0
        },

        // Everything inside the panel, laid out top to bottom. It is what takes the taps which show and hide the
        // toolbar, so it has to fill the panel rather than only the rows which happen to have something in them.
        panelBody: {
            flex: 1,
            flexDirection: 'column' as const
        },

        // The grabber row at the top of the panel.
        topRow: {
            alignItems: 'center' as const,
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            paddingVertical: BaseTheme.spacing[1]
        },

        // Also the area the pull-down drag is picked up in, so it is padded out to something a thumb can land on: the
        // bar it draws is 4pt tall and nobody can be asked to hit that.
        grabberWrap: {
            flex: 1,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            paddingVertical: BaseTheme.spacing[3]
        },

        // The same, for the list the language dropdown opens, which has no header to borrow its padding from.
        grabberZone: {
            alignItems: 'center' as const,
            paddingVertical: BaseTheme.spacing[3]
        },

        grabber: {
            backgroundColor: palette.divider,
            borderRadius: 2,
            height: 4,
            width: 36
        },

        headerIconButton: {
            alignItems: 'center' as const,
            backgroundColor: palette.card,
            borderColor: palette.divider,
            borderRadius: 10,
            borderWidth: 1,
            height: 32,
            justifyContent: 'center' as const,
            width: 32
        },

        themeToggle: {
            backgroundColor: palette.segment,
            borderRadius: 12,
            flexDirection: 'row' as const,
            overflow: 'hidden' as const
        },

        themeSegment: {
            paddingHorizontal: BaseTheme.spacing[2],
            paddingVertical: BaseTheme.spacing[1] / 2
        },

        themeSegmentSelected: {
            backgroundColor: palette.accent
        },

        themeSegmentLabel: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted
        },

        themeSegmentLabelSelected: {
            color: '#FFFFFF'
        },

        // Says that more than one person is talking, without taking the focus to say it.
        speakersChip: {
            alignSelf: 'flex-start' as const,
            backgroundColor: palette.card,
            borderRadius: 12,
            marginBottom: BaseTheme.spacing[2],
            paddingHorizontal: BaseTheme.spacing[2],
            paddingVertical: BaseTheme.spacing[1] / 2
        },

        speakersChipLabel: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted
        },

        // The whole conversation in one card which scrolls inside itself, rather than a card per utterance.
        //
        // A stack of cards draws a box around every sentence and makes the panel read as a list of separate notices;
        // one card reads as a transcript, which is what it is. Takes whatever room the controls underneath do not, so
        // a taller panel shows more of the conversation rather than more empty space.
        transcriptCard: {
            backgroundColor: palette.card,
            borderRadius: 18,
            flex: 1,
            overflow: 'hidden' as const
        },

        transcriptScroll: {
            flex: 1
        },

        transcriptContent: {
            padding: BaseTheme.spacing[2]
        },

        transcriptEmpty: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted,
            padding: BaseTheme.spacing[3]
        },

        // One utterance. Separated from the next by a rule rather than by a gap between cards, so that the eye can
        // still find where one ends without each being boxed off from the conversation it is part of.
        transcriptEntry: {
            borderTopColor: palette.divider,
            borderTopWidth: 1,
            paddingTop: BaseTheme.spacing[2]
        },

        // Nothing above the first one to be separated from.
        transcriptEntryFirst: {
            borderTopWidth: 0,
            paddingTop: 0
        },

        transcriptEntryPending: {
            backgroundColor: `${palette.accent}1a`,
            borderLeftColor: palette.accent,
            borderLeftWidth: 3,
            paddingLeft: BaseTheme.spacing[2] - 3
        },

        transcriptMeta: {
            alignItems: 'center' as const,
            flexDirection: 'row' as const,
            marginBottom: BaseTheme.spacing[1]
        },

        // Which language the utterance arrived in. Always English, and shown anyway, because a reader comparing the
        // two lines should be able to see which is the one that was said.
        transcriptBadge: {
            backgroundColor: palette.badge,
            borderRadius: 6,
            paddingHorizontal: BaseTheme.spacing[1],
            paddingVertical: 2
        },

        transcriptBadgeLabel: {
            ...BaseTheme.typography.bodyShortBold,
            color: palette.textMuted
        },

        transcriptSpeaker: {
            ...BaseTheme.typography.bodyShortBold,
            color: palette.text,
            flex: 1,
            marginLeft: BaseTheme.spacing[2]
        },

        transcriptTime: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted
        },

        transcriptOriginal: {
            ...BaseTheme.typography.bodyShortRegular,
            color: palette.text
        },

        transcriptTranslated: {
            ...BaseTheme.typography.bodyShortRegular,
            color: palette.textMuted,
            marginTop: BaseTheme.spacing[1]
        },

        // Stands in for the translation until it arrives, so that a line still being worked on is not mistaken for one
        // which came back in the language it was said in.
        transcriptTranslating: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted,
            fontStyle: 'italic' as const,
            marginTop: BaseTheme.spacing[1]
        },

        controlRow: {
            alignItems: 'center' as const,
            flexDirection: 'row' as const,
            marginTop: BaseTheme.spacing[2]
        },

        // The language chip shown under the transcript.
        languagePillExpanded: {
            flex: 1,
            marginRight: BaseTheme.spacing[2],
            marginTop: 0
        },

        languageDropdown: {
            flex: 1
        },

        automaticPill: {
            alignItems: 'center' as const,
            backgroundColor: palette.card,
            borderRadius: 16,
            flexDirection: 'row' as const,
            marginRight: BaseTheme.spacing[2],
            paddingHorizontal: BaseTheme.spacing[2],
            paddingVertical: BaseTheme.spacing[1]
        },

        automaticPillLabel: {
            ...BaseTheme.typography.bodyShortRegularLarge,
            color: palette.text,
            marginLeft: BaseTheme.spacing[1]
        },

        squareButton: {
            alignItems: 'center' as const,
            backgroundColor: palette.card,
            borderColor: palette.divider,
            borderRadius: 16,
            borderWidth: 1,
            height: 52,
            justifyContent: 'center' as const,
            marginLeft: BaseTheme.spacing[1],
            marginTop: BaseTheme.spacing[1],
            width: 52
        },

        squareButtonActive: {
            backgroundColor: `${palette.accent}1a`,
            borderColor: palette.accent
        },

        squareButtonInactive: {
            backgroundColor: palette.segment,
            borderColor: palette.divider
        },

        // Named as the sheets name it, so that the dropdown can be handed either set of styles and reach the same
        // thing in both.
        fieldHelper: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted,
            marginTop: BaseTheme.spacing[1]
        },

        panelFooter: {
            alignItems: 'center' as const,
            flexDirection: 'row' as const,
            marginTop: BaseTheme.spacing[3]
        },

        disclaimer: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted,
            flex: 1,
            marginRight: BaseTheme.spacing[2]
        },

        // Ends the session for the whole room, so it is drawn as the one thing on the panel which takes something away
        // rather than as another control which changes what the local user hears.
        closeTranscript: {
            paddingVertical: BaseTheme.spacing[1]
        },

        closeTranscriptLabel: {
            ...BaseTheme.typography.bodyShortBold,
            color: palette.danger
        },

        // The language control, which is the dropdown drawn in the panel's colours rather than the sheet's.
        languagePill: {
            alignItems: 'center' as const,
            backgroundColor: palette.card,
            borderRadius: 16,
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            marginTop: BaseTheme.spacing[2],
            paddingHorizontal: BaseTheme.spacing[3],
            paddingVertical: BaseTheme.spacing[2]
        },

        languagePillCopy: {
            flex: 1,
            marginRight: BaseTheme.spacing[2]
        },

        languagePillCaption: {
            ...BaseTheme.typography.bodyShortRegularSmall,
            color: palette.textMuted
        },

        languagePillName: {
            ...BaseTheme.typography.bodyShortRegularLarge,
            color: palette.text
        },

        // The list the dropdown opens, in the same colours: a light panel opening a dark list reads as a fault rather
        // than as a choice.
        listBackdrop: {
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            flex: 1,
            justifyContent: 'flex-end' as const
        },

        listSheet: {
            backgroundColor: palette.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '75%' as const,
            paddingBottom: BaseTheme.spacing[4],
            paddingHorizontal: BaseTheme.spacing[3]
        },

        listTitle: {
            ...BaseTheme.typography.bodyShortBold,
            color: palette.text,
            marginBottom: BaseTheme.spacing[2]
        },

        listSearch: {
            ...BaseTheme.typography.bodyShortRegular,
            backgroundColor: palette.card,
            borderRadius: BaseTheme.shape.borderRadius,
            color: palette.text,
            marginBottom: BaseTheme.spacing[2],
            paddingHorizontal: BaseTheme.spacing[2],
            paddingVertical: BaseTheme.spacing[2]
        },

        listRow: {
            alignItems: 'center' as const,
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            paddingVertical: BaseTheme.spacing[2]
        },

        listRowText: {
            ...BaseTheme.typography.bodyShortRegular,
            color: palette.textMuted
        },

        listRowTextActive: {
            color: palette.text
        }
    };
}

/**
 * Returns the panel's styles in one of the two themes.
 *
 * @param {S2SV2Theme} theme - Which of the two.
 * @returns {Object}
 */
export default function getS2SV2PanelStyles(theme: S2SV2Theme) {
    const cached = cache.get(theme);

    if (cached) {
        return cached;
    }

    const styles = _create(getS2SV2Palette(theme));

    cache.set(theme, styles);

    return styles;
}
