import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export default {
    container: {
        backgroundColor: BaseTheme.palette.ui01,
        flex: 1
    },

    content: {
        padding: BaseTheme.spacing[4]
    },

    screenContent: {
        flexGrow: 1
    },

    headerCard: {
        backgroundColor: BaseTheme.palette.ui02,
        borderRadius: 8,
        marginBottom: BaseTheme.spacing[3],
        padding: BaseTheme.spacing[3]
    },

    title: {
        ...BaseTheme.typography.heading6,
        color: BaseTheme.palette.text01,
        flexShrink: 1,
        marginBottom: BaseTheme.spacing[1]
    },

    description: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        lineHeight: 20
    },

    statusRow: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: BaseTheme.spacing[2]
    },

    statusDot: {
        backgroundColor: BaseTheme.palette.action01,
        borderRadius: 4,
        height: 8,
        marginRight: BaseTheme.spacing[1],
        width: 8
    },

    statusText: {
        ...BaseTheme.typography.labelBold,
        color: BaseTheme.palette.action01
    },

    section: {
        marginBottom: BaseTheme.spacing[3]
    },

    sectionTitle: {
        ...BaseTheme.typography.labelBold,
        color: BaseTheme.palette.text02,
        marginBottom: BaseTheme.spacing[1]
    },

    languageField: {
        backgroundColor: BaseTheme.palette.ui02,
        borderRadius: 8,
        marginBottom: BaseTheme.spacing[2],
        overflow: 'hidden'
    },

    languageTrigger: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        minWidth: 0,
        minHeight: 56,
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    languageLabel: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01
    },

    languageValue: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        marginLeft: BaseTheme.spacing[2],
        textAlign: 'right'
    },

    dropdown: {
        borderTopColor: BaseTheme.palette.ui04,
        borderTopWidth: 1,
        maxHeight: 260,
        padding: BaseTheme.spacing[2]
    },

    searchInput: {
        ...BaseTheme.typography.bodyShortRegular,
        backgroundColor: BaseTheme.palette.ui01,
        borderColor: BaseTheme.palette.ui04,
        borderRadius: 8,
        borderWidth: 1,
        color: BaseTheme.palette.text01,
        marginBottom: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[1]
    },

    languageOption: {
        alignItems: 'center' as const,
        borderRadius: 6,
        flexDirection: 'row' as const,
        minHeight: 44,
        paddingHorizontal: BaseTheme.spacing[2]
    },

    languageOptionSelected: {
        backgroundColor: 'rgba(70, 135, 237, 0.16)'
    },

    languageOptionText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text01,
        flex: 1
    },

    optionContent: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row'
    },

    checkIcon: {
        color: BaseTheme.palette.action01,
        fontSize: 20
    },

    notice: {
        backgroundColor: 'rgba(70, 135, 237, 0.12)',
        borderColor: 'rgba(70, 135, 237, 0.35)',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: BaseTheme.spacing[3],
        padding: BaseTheme.spacing[3]
    },

    noticeText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text01,
        lineHeight: 20
    },

    noticeTextSpacing: {
        marginTop: BaseTheme.spacing[2]
    },

    switchRow: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.ui02,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: BaseTheme.spacing[3],
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    switchLabel: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text01,
        flex: 1,
        minWidth: 0
    },

    participantItem: {
        alignItems: 'center' as const,
        backgroundColor: BaseTheme.palette.ui02,
        borderRadius: 8,
        flexDirection: 'row' as const,
        marginBottom: BaseTheme.spacing[1],
        minHeight: 52,
        paddingHorizontal: BaseTheme.spacing[3]
    },

    participantItemSelected: {
        borderColor: BaseTheme.palette.action01,
        borderWidth: 1
    },

    participantInitial: {
        backgroundColor: BaseTheme.palette.action01,
        borderRadius: 16,
        color: BaseTheme.palette.text04,
        height: 32,
        lineHeight: 32,
        marginRight: BaseTheme.spacing[2],
        textAlign: 'center' as const,
        width: 32
    },

    participantName: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text01,
        flex: 1
    },

    errorText: {
        ...BaseTheme.typography.labelRegular,
        color: BaseTheme.palette.actionDanger,
        marginBottom: BaseTheme.spacing[2]
    },

    footer: {
        flexDirection: 'row',
        gap: BaseTheme.spacing[2],
        marginBottom: BaseTheme.spacing[5]
    },

    footerButton: {
        flex: 1
    },

    tileLanguageBadgeContainer: {
        alignItems: 'flex-end' as const,
        maxWidth: '86%',
        position: 'absolute' as const,
        right: BaseTheme.spacing[2],
        top: BaseTheme.spacing[2],
        zIndex: 5
    },

    tileLanguageBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: BaseTheme.spacing[1],
        maxWidth: 260,
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[1]
    },

    tileLanguageBadgeActive: {
        borderColor: 'rgba(70, 135, 237, 0.72)'
    },

    tileLanguageBadgeText: {
        ...BaseTheme.typography.labelBold,
        color: '#FFFFFF',
        letterSpacing: 0
    }
};
