import BaseTheme from '../../../base/ui/components/BaseTheme.native';

/**
 * The panel is a white card sitting under the dark meeting video, so it is built out of its own small set of values
 * rather than out of the meeting theme. Everything below is derived from these and nothing else, which is what keeps
 * the panel reading as a single instrument rather than as a stack of unrelated controls.
 *
 * The accent stands for the machine listening and speaking; the live colour is kept for the one thing which really is a
 * broadcast state, the recording dot.
 */
const COLORS = {
    accent: '#0EA5E9',
    accentLine: 'rgba(14, 165, 233, 0.35)',
    accentSoft: 'rgba(14, 165, 233, 0.08)',
    line: '#E5E7EB',
    live: '#EF4444',
    raised: '#F6F8FA',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280'
};

/**
 * Every label in the panel is the same small upright caption, so the eye reads one grid of labels rather than a dozen
 * differently sized pieces of text.
 */
const CAPTION = {
    ...BaseTheme.typography.bodyShortRegularSmall,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
};

export default {
    panel: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.accentLine,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0
    },

    // The handle at the top edge, which says the panel is a surface of its own and not part of the video.
    grabber: {
        alignSelf: 'center',
        backgroundColor: COLORS.line,
        borderRadius: 999,
        height: 4,
        marginTop: BaseTheme.spacing[1],
        width: 36
    },

    // "Live translation", what it is doing with the sound, and the way out. Kept to one line: everything this row does
    // not take is room the participants get.
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[2]
    },

    liveDot: {
        backgroundColor: COLORS.live,
        borderRadius: 999,
        height: 6,
        marginRight: BaseTheme.spacing[1],
        width: 6
    },

    liveLabel: {
        ...CAPTION,
        color: COLORS.text,
        flexShrink: 0,
        marginRight: BaseTheme.spacing[2]
    },

    closeButton: {
        alignItems: 'center',
        borderColor: COLORS.line,
        borderRadius: 8,
        borderWidth: 1,
        height: 26,
        justifyContent: 'center',
        marginLeft: BaseTheme.spacing[2],
        width: 26
    },

    // The one setting the panel has. It carries its own label, so it sits on the title line instead of taking a row of
    // its own away from the participants.
    languagePill: {
        alignItems: 'center',
        backgroundColor: COLORS.raised,
        borderColor: COLORS.line,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 1,
        justifyContent: 'space-between',

        // Only as wide as it has to be: the title keeps its size, and whatever is left over goes to the gap between
        // them rather than to a control which has one short word to show.
        marginLeft: 'auto',
        maxWidth: 168,
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: 5
    },

    languagePillLabels: {
        flexShrink: 1
    },

    languagePillLabel: {
        ...CAPTION,
        color: COLORS.textMuted
    },

    languagePillName: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.text
    },

    languagePillTrailing: {
        alignItems: 'center',
        flexDirection: 'row'
    },

    languagePillCodeChip: {
        backgroundColor: COLORS.accentSoft,
        borderRadius: 6,
        marginRight: BaseTheme.spacing[1],
        paddingHorizontal: 6,
        paddingVertical: 1
    },

    languagePillCode: {
        ...CAPTION,
        color: COLORS.accent
    },

    // Where the transcript would be, had this been a captions panel. It says who is talking instead, and it gets every
    // point of height the two rows above it do not need.
    speakers: {
        flex: 1
    },

    speakersContent: {
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[2]
    },

    speakerRow: {
        alignItems: 'center',
        backgroundColor: COLORS.raised,
        borderColor: 'transparent',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[1],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[1]
    },

    speakerRowActive: {
        backgroundColor: COLORS.accentSoft,
        borderColor: COLORS.accentLine
    },

    avatarWrapper: {
        alignItems: 'center',
        height: 32,
        justifyContent: 'center',
        width: 32
    },

    // Drawn around the avatar of whoever is talking, so the row is recognisable before any of it is read.
    avatarRing: {
        borderColor: COLORS.accent,
        borderRadius: 999,
        borderWidth: 1.5,
        bottom: -3,
        left: -3,
        position: 'absolute',
        right: -3,
        top: -3
    },

    speakerText: {
        flex: 1,
        marginLeft: BaseTheme.spacing[2]
    },

    speakerName: {
        ...BaseTheme.typography.bodyShortBold,
        color: COLORS.text
    },

    speakerState: {
        ...CAPTION,
        color: COLORS.textMuted
    },

    speakerStateActive: {
        color: COLORS.accent
    },

    emptyText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted,
        paddingVertical: BaseTheme.spacing[4],
        textAlign: 'center'
    },

    // The bars next to whoever is talking, in place of the waveform a spoken message would draw.
    waveform: {
        alignItems: 'center',
        flexDirection: 'row',
        height: 20,
        justifyContent: 'flex-end',
        width: 36
    },

    waveformBar: {
        backgroundColor: COLORS.accent,
        borderRadius: 999,
        height: 16,
        marginLeft: 3,
        width: 2
    },

    sheetBackdrop: {
        backgroundColor: 'rgba(17, 24, 39, 0.45)',
        flex: 1,
        justifyContent: 'flex-end'
    },

    sheet: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.accentLine,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderTopWidth: 1,
        maxHeight: '70%',
        paddingBottom: BaseTheme.spacing[3]
    },

    sheetTitle: {
        ...CAPTION,
        color: COLORS.textMuted,
        marginBottom: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[3]
    },

    sheetSearch: {
        ...BaseTheme.typography.bodyShortRegular,
        backgroundColor: COLORS.raised,
        borderColor: COLORS.line,
        borderRadius: 10,
        borderWidth: 1,
        color: COLORS.text,
        marginBottom: BaseTheme.spacing[2],
        marginHorizontal: BaseTheme.spacing[3],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: 8
    },

    sheetRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    sheetRowText: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: COLORS.text,
        flexShrink: 1
    },

    sheetRowTextActive: {
        color: COLORS.accent
    }
};

export { COLORS as LIVE_TRANSLATION_COLORS };
