import BaseTheme from '../../../base/ui/components/BaseTheme.native';

/**
 * The colours the sheets are drawn in: the one which asks which language to listen in, and the one which asks a
 * moderator to confirm before ending a session.
 *
 * Always dark, because both sit over the meeting rather than in it. The panel is the surface which can be either, and
 * its colours are in {@link ./palettes} where there are two sets of them.
 */
export const S2S_V2_COLORS = {
    accent: BaseTheme.palette.action01,
    badge: BaseTheme.palette.ui03,
    card: BaseTheme.palette.ui02,
    divider: BaseTheme.palette.ui04,
    live: '#16A34A',
    selected: BaseTheme.palette.action01,
    text: BaseTheme.palette.text01,
    textMuted: BaseTheme.palette.text02
};

export default {

    sheet: {
        backgroundColor: BaseTheme.palette.ui01
    },

    // Handed to BottomSheet, which draws the box the sheet lives in. Left unpainted because that box does not move
    // when the sheet is dragged, and a sheet whose background stays behind while its contents slide away reads as a
    // fault rather than as a gesture.
    sheetChrome: {
        backgroundColor: 'transparent'
    },

    // What the sheet actually looks like, on the one view which follows the finger.
    sheetSurface: {
        backgroundColor: BaseTheme.palette.ui01,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden'
    },

    // The area the pull-down drag is picked up in. Wider and taller than the bar it draws, because a 4pt line is not
    // something a thumb can be asked to land on.
    grabberZone: {
        alignItems: 'center',
        paddingVertical: BaseTheme.spacing[3]
    },

    // The bar at the top which says the sheet can be pulled down.
    grabber: {
        alignSelf: 'center',
        backgroundColor: S2S_V2_COLORS.divider,
        borderRadius: 2,
        marginTop: BaseTheme.spacing[1],
        height: 4,
        width: 36
    },

    body: {
        paddingBottom: BaseTheme.spacing[4],
        paddingHorizontal: BaseTheme.spacing[3]
    },

    header: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[3]
    },

    headerIcon: {
        alignItems: 'center',
        backgroundColor: S2S_V2_COLORS.card,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        marginRight: BaseTheme.spacing[2],
        width: 40
    },

    headerCopy: {
        flex: 1
    },

    title: {
        ...BaseTheme.typography.bodyShortBold,
        color: S2S_V2_COLORS.text,
        marginBottom: BaseTheme.spacing[1]
    },

    description: {
        ...BaseTheme.typography.bodyShortRegular,
        color: S2S_V2_COLORS.textMuted
    },

    fieldLabel: {
        ...BaseTheme.typography.bodyShortBold,
        color: S2S_V2_COLORS.text,
        marginBottom: BaseTheme.spacing[2]
    },

    fieldHelper: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: S2S_V2_COLORS.textMuted,
        marginTop: BaseTheme.spacing[1]
    },

    // The closed dropdown: one line saying what is chosen, with the affordance that it can be changed.
    languagePill: {
        alignItems: 'center',
        backgroundColor: S2S_V2_COLORS.card,
        borderRadius: BaseTheme.shape.borderRadius,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    languagePillCopy: {
        flex: 1,
        marginRight: BaseTheme.spacing[2]
    },

    // Names what the choice underneath is for, where the control is not already sitting under a label of its own.
    languagePillCaption: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: S2S_V2_COLORS.textMuted
    },

    languagePillName: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: S2S_V2_COLORS.text
    },

    // The open list.
    listBackdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        flex: 1,
        justifyContent: 'flex-end'
    },

    listSheet: {
        backgroundColor: BaseTheme.palette.ui01,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '75%',
        paddingBottom: BaseTheme.spacing[4],
        paddingHorizontal: BaseTheme.spacing[3]
    },

    listTitle: {
        ...BaseTheme.typography.bodyShortBold,
        color: S2S_V2_COLORS.text,
        marginBottom: BaseTheme.spacing[2]
    },

    listSearch: {
        ...BaseTheme.typography.bodyShortRegular,
        backgroundColor: S2S_V2_COLORS.card,
        borderRadius: BaseTheme.shape.borderRadius,
        color: S2S_V2_COLORS.text,
        marginBottom: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[2]
    },

    listRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: BaseTheme.spacing[2]
    },

    listRowText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: S2S_V2_COLORS.textMuted
    },

    listRowTextActive: {
        color: S2S_V2_COLORS.text
    },

    divider: {
        backgroundColor: S2S_V2_COLORS.divider,
        height: 1,
        marginVertical: BaseTheme.spacing[3]
    },

    toggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },

    toggleCopy: {
        flex: 1,
        marginRight: BaseTheme.spacing[2]
    },

    toggleLabel: {
        ...BaseTheme.typography.bodyShortRegular,
        color: S2S_V2_COLORS.text
    },

    actions: {
        flexDirection: 'row',
        marginTop: BaseTheme.spacing[4]
    },

    button: {
        alignItems: 'center',
        borderRadius: BaseTheme.shape.borderRadius,
        flex: 1,
        justifyContent: 'center',
        paddingVertical: BaseTheme.spacing[2]
    },

    buttonDismiss: {
        backgroundColor: S2S_V2_COLORS.card,
        marginRight: BaseTheme.spacing[2]
    },

    // The one action in the feature which takes something away from everybody else, drawn so that it does not look
    // like the one which does not.
    buttonDestructive: {
        backgroundColor: BaseTheme.palette.actionDanger
    },

    buttonPrimary: {
        backgroundColor: S2S_V2_COLORS.accent
    },

    buttonLabel: {
        ...BaseTheme.typography.bodyShortBold
    },

    buttonLabelDismiss: {
        color: S2S_V2_COLORS.text
    },

    buttonLabelPrimary: {
        color: BaseTheme.palette.text01
    }
};
