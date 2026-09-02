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

    // Where the panel says what it is doing with the sound: heard, sending, or nothing at all. One line, above the
    // transcript, so the state of the call is read before anything that was said in it.
    statusRow: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingBottom: BaseTheme.spacing[2]
    },

    statusIcon: {
        marginRight: BaseTheme.spacing[1]
    },

    statusText: {
        ...CAPTION,
        color: COLORS.textMuted,
        flex: 1
    },

    // The one state which is somebody talking rather than the panel waiting.
    statusTextActive: {
        color: COLORS.accent
    },

    statusTextError: {
        color: COLORS.action
    },

    // The transcript: what was said, and what is being read out in its place, oldest at the top. It gets every point of
    // height the status line and the controls do not need, and scrolls for the rest.
    transcript: {
        flex: 1
    },

    transcriptContent: {
        paddingBottom: BaseTheme.spacing[1]
    },

    // One utterance, full width, stacked under the one before it.
    transcriptCard: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.line,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[1],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[2]
    },

    // The one being read out loud, which in a list of them is the one worth finding. Marked rather than moved: it is
    // where it was said, and the ear is already following it.
    transcriptCardSpeaking: {
        backgroundColor: COLORS.accentSoft,
        borderColor: COLORS.accentLine
    },

    // Who said it. Beside the words rather than above them, so that the two lines of the utterance stay together, and
    // held to a share of the width so that a long name cannot take the card over from what was said in it.
    senderBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',

        // The one dark mark on a light card. The name has to be read as a label rather than as part of the sentence next
        // to it, and inverting it is what separates the two without a second type size.
        backgroundColor: COLORS.text,
        borderRadius: 4,
        flexShrink: 1,
        justifyContent: 'center',
        marginRight: BaseTheme.spacing[2],
        marginTop: 1,
        maxWidth: '30%',
        paddingHorizontal: 5,
        paddingVertical: 2
    },

    senderBadgeText: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: COLORS.surface,
        flexShrink: 1,
        fontWeight: 'bold',
        letterSpacing: 0.4
    },

    utteranceText: {
        flex: 1,
        minWidth: 0
    },

    // What was said. Read first and read most, so it carries the weight.
    utteranceOriginal: {
        ...BaseTheme.typography.bodyShortBold,
        color: COLORS.text,
        lineHeight: 20
    },

    // What is read aloud in its place. Quieter than the original: it is the same thing said again, and the ear is
    // getting it anyway.
    utteranceTranslation: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted,
        lineHeight: 20,
        marginTop: BaseTheme.spacing[1]
    },

    // Held for as long as the translation service takes, so the card does not change height when it answers.
    utteranceTranslationPending: {
        fontStyle: 'italic'
    },

    emptyCardText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted,
        textAlign: 'center'
    },

    emptyCard: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderColor: COLORS.line,
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: BaseTheme.spacing[3]
    },

    // The two things the panel can be told to do: what to turn everything into, and to stop. On one line under the
    // transcript, where a caption bar puts them.
    controls: {
        alignItems: 'center',
        flexDirection: 'row',
        minWidth: 0,

        // Off the scale by design: the language and the switch are the last things in the panel, and they want clearing
        // from its bottom edge rather than a whole step of it.
        paddingBottom: 8,
        paddingTop: BaseTheme.spacing[2]
    },

    controlsLabel: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.textMuted,
        flexShrink: 1,
        marginRight: BaseTheme.spacing[2]
    },

    // The way out, drawn as the caption switch it is: it says what the panel is doing, and tapping it stops.
    ccButton: {
        alignItems: 'center',
        borderColor: COLORS.action,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 1,
        marginLeft: 'auto',
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: 7
    },

    ccMark: {
        ...BaseTheme.typography.bodyShortBold,
        color: COLORS.action,
        flexShrink: 1,
        letterSpacing: 0.5,
        marginRight: BaseTheme.spacing[1]
    },

    ccState: {
        ...BaseTheme.typography.bodyShortRegular,
        color: COLORS.action,
        flexShrink: 1
    },

    // The one setting the panel has, on the controls line next to the label saying what it sets.
    languagePill: {
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderColor: COLORS.line,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 1,
        justifyContent: 'space-between',
        maxWidth: 160,
        paddingHorizontal: BaseTheme.spacing[2] + 2,
        paddingVertical: 9
    },

    languagePillName: {
        ...BaseTheme.typography.bodyShortBold,
        color: COLORS.text,
        flex: 1,
        minWidth: 0,
        flexShrink: 1
    },

    languagePillTrailing: {
        alignItems: 'center',
        flexDirection: 'row'
    },

    // The bars next to the utterance being read out, in place of the level meter its voice would draw.
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
        flex: 1,
        minWidth: 0,
        flexShrink: 1
    },

    sheetRowTextActive: {
        color: COLORS.accent
    },

    // The invitation to join somebody else's translated call, and the two things worth settling before joining one.
    //
    // A sheet rather than a card floating clear of the edges: it is answered while the phone is being held, often in one
    // hand, and a sheet puts its buttons where the thumb already is. Only the top corners are rounded, because the bottom
    // of it is the bottom of the screen.
    inviteSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16
    },

    inviteBody: {
        paddingBottom: BaseTheme.spacing[3],
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[1]
    },

    // The mark, what this is, and who is asking. The mark is aligned with the top of the two lines beside it rather than
    // centred against them, so the three read as one block starting at one height.
    inviteHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[3]
    },

    inviteIcon: {
        alignItems: 'center',
        backgroundColor: COLORS.accentSoft,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        marginRight: BaseTheme.spacing[2] + 4,
        width: 40
    },

    inviteHeaderCopy: {
        flex: 1,
        minWidth: 0,
        paddingTop: 2
    },

    inviteTitle: {
        color: COLORS.text,
        flexShrink: 1,
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 20
    },

    // Who started it, which is the whole of what makes the question answerable. Everything else on the sheet is a
    // setting, and none of it says this.
    inviteDescription: {
        color: COLORS.textMuted,
        flexShrink: 1,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2
    },

    // What the control below it sets. Above the control rather than beside it: the control is as wide as the sheet.
    inviteFieldLabel: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: '500',
        marginBottom: BaseTheme.spacing[1]
    },

    // What the control cannot say for itself. Under both the language and the switch, in the same voice.
    inviteFieldHelper: {
        color: COLORS.textMuted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: BaseTheme.spacing[1] - 1
    },

    // The language pill, given the width of the sheet and the height a thumb needs.
    inviteDropdown: {
        maxWidth: undefined,
        minHeight: 44,
        paddingVertical: 0
    },

    // Between what is heard and how it is heard: two settings which are read one after the other, not compared.
    inviteDivider: {
        backgroundColor: COLORS.line,
        height: 1,
        marginVertical: BaseTheme.spacing[3]
    },

    inviteToggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        minHeight: 44
    },

    inviteToggleCopy: {
        flex: 1,
        minWidth: 0,
        marginRight: BaseTheme.spacing[2] + 4
    },

    inviteToggleLabel: {
        color: COLORS.text,
        flexShrink: 1,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20
    },

    // Both answers share the width evenly, so neither has to be aimed at. Which is which is said by the fill, not by
    // the size: the one that commits is the one that is coloured in.
    inviteActions: {
        flexDirection: 'row',
        marginTop: BaseTheme.spacing[4]
    },

    inviteButton: {
        alignItems: 'center',
        borderRadius: 8,
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        minHeight: 44
    },

    inviteButtonDecline: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.line,
        borderWidth: 1,
        marginRight: BaseTheme.spacing[2] + 4
    },

    inviteButtonAccept: {
        backgroundColor: COLORS.action
    },

    inviteButtonLabel: {
        alignSelf: 'stretch',
        flexShrink: 1,
        fontSize: 15,
        fontWeight: '500',
        includeFontPadding: false,
        textAlign: 'center',
        width: '100%'
    },

    inviteButtonLabelDecline: {
        color: COLORS.text
    },

    inviteButtonLabelAccept: {
        color: COLORS.surface
    }
};

export { COLORS as LIVE_TRANSLATION_COLORS };
