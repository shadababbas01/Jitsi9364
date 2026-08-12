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

    // The red a confirmation is committed in, taken from the sign out sheet so that the two confirmations in the app
    // are recognisably the same act. Named apart from the live colour below because one is a state the meeting is in
    // and the other is a button.
    action: '#E8402E',
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
        backgroundColor: 'transparent',
        bottom: 0,
        paddingBottom: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingTop: BaseTheme.spacing[1],
        left: 0,
        position: 'absolute',
        right: 0
    },

    surface: {
        backgroundColor: COLORS.surface,
        borderColor: '#b3b3b3ff',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        overflow: 'hidden',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[2],

        shadowColor: '#111827',
        shadowOffset: {
            height: -6,
            width: 0
        },
        shadowOpacity: 0.08,
        shadowRadius: 18
    },

    // The handle at the top edge, which says the panel is a surface of its own and not part of the video.
    grabber: {
        alignSelf: 'center',
        backgroundColor: COLORS.line,
        borderRadius: 999,
        height: 4,
        marginBottom: BaseTheme.spacing[2],
        width: 36
    },

    // "Live translation", what it is doing with the sound, and the way out. Kept to one line: everything this row does
    // not take is room the participants get.
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingBottom: BaseTheme.spacing[2]
    },

    headerIcon: {
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        height: 44,
        justifyContent: 'center',
        marginRight: BaseTheme.spacing[2],
        width: 44
    },

    headerCopy: {
        flex: 1,
        justifyContent: 'center'
    },

    headerActions: {
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: BaseTheme.spacing[2]
    },

    liveLabel: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: COLORS.text,
        marginBottom: 1
    },

    liveSubtitle: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted
    },

    closeButton: {
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        height: 36,
        justifyContent: 'center',
        marginLeft: BaseTheme.spacing[1],
        width: 36
    },

    // The one setting the panel has. It carries its own label, so it sits on the title line instead of taking a row of
    // its own away from the participants.
    languagePill: {
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderColor: COLORS.line,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 1,
        justifyContent: 'space-between',
        marginLeft: 'auto',
        maxWidth: 160,
        paddingHorizontal: BaseTheme.spacing[2] + 2,
        paddingVertical: 9
    },

    languagePillName: {
        ...BaseTheme.typography.bodyShortBold,
        color: COLORS.text,
        flexShrink: 1
    },

    languagePillTrailing: {
        alignItems: 'center',
        flexDirection: 'row'
    },

    // Where the transcript would be, had this been a captions panel. It says who is talking instead, and it gets every
    // point of height the two rows above it do not need.
    speakers: {
        flex: 1
    },

    sectionTitle: {
        ...CAPTION,
        color: COLORS.textMuted,
        marginBottom: BaseTheme.spacing[2],
        marginTop: BaseTheme.spacing[1]
    },

    speakersContent: {
        paddingBottom: BaseTheme.spacing[1]
    },

    speakerRow: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderColor: '#b3b3b3ff',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[1],
        minHeight: 56,
        paddingHorizontal: BaseTheme.spacing[2] + 2,
        paddingVertical: BaseTheme.spacing[1]
    },

    speakerRowActive: {
        backgroundColor: COLORS.surface,
        borderColor: '#EE4136',
    },

    participantBadge: {
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
        borderRadius: 999,
        height: 48,
        justifyContent: 'center',
        position: 'relative',
        width: 48
    },

    participantBadgeActive: {
        backgroundColor: '#FFF7F6',
        borderColor: COLORS.action,
        borderWidth: 2
    },

    participantBadgeText: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: COLORS.text
    },

    participantBadgeTextActive: {
        color: COLORS.text
    },

    participantBadgeDot: {
        backgroundColor: COLORS.action,
        borderRadius: 999,
        bottom: -1,
        height: 10,
        position: 'absolute',
        right: -1,
        width: 10
    },

    speakerText: {
        flex: 1,
        marginLeft: BaseTheme.spacing[2],
        marginRight: BaseTheme.spacing[1]
    },

    speakerName: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: COLORS.text
    },

    speakerStateRow: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 2
    },

    speakerState: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted
    },

    speakerStateActive: {
        color: COLORS.action
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
        height: 16,
        justifyContent: 'flex-end',
        width: 28
    },

    waveformBar: {
        backgroundColor: COLORS.action,
        borderRadius: 999,
        height: 12,
        marginLeft: 2,
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
    },

    // The invitation to join somebody else's translated call. A card at the thumb end of the screen rather than a dialog
    // in the middle of it: it is answered while the phone is being held, often in one hand. It stands clear of all four
    // edges so that it reads as something laid on top of the call rather than as part of the window.
    inviteSheet: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,

        // Half a step off the scale. A whole one leaves the card looking marooned, none of it and it is a drawer.
        marginBottom: 12,
        marginHorizontal: 12
    },

    inviteBody: {
        paddingBottom: BaseTheme.spacing[3],
        paddingHorizontal: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[3]
    },

    // The mark and the question on one line: what is being asked reads in a single movement of the eye rather than as
    // a symbol followed by a caption underneath it.
    inviteHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[3]
    },

    inviteIcon: {
        alignItems: 'center',
        backgroundColor: COLORS.raised,
        borderRadius: 24,
        height: 48,
        justifyContent: 'center',
        marginRight: BaseTheme.spacing[3],
        width: 48
    },

    inviteTitle: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: COLORS.text,
        flexShrink: 1
    },

    // Full strength rather than muted: there is one line of it and it carries the whole question.
    inviteDescription: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: COLORS.text,
        lineHeight: 22
    },

    // Both answers are the same size and share the width evenly, so neither has to be aimed at.
    inviteActions: {
        flexDirection: 'row',
        marginTop: BaseTheme.spacing[4]
    },

    inviteButton: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        justifyContent: 'center',
        paddingVertical: BaseTheme.spacing[2] + 4
    },

    inviteButtonDecline: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.text,
        borderWidth: 1,
        marginRight: BaseTheme.spacing[2] + 4
    },

    inviteButtonAccept: {
        backgroundColor: COLORS.action
    },

    inviteButtonLabel: {
        ...BaseTheme.typography.bodyShortBoldLarge
    },

    inviteButtonLabelDecline: {
        color: COLORS.text
    },

    inviteButtonLabelAccept: {
        color: COLORS.surface
    }
};

export { COLORS as LIVE_TRANSLATION_COLORS };
