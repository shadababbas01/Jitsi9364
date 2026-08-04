import { StyleSheet } from 'react-native';

import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export default StyleSheet.create({
    actionButton: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.link01,
        borderRadius: 12,
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    actionButtonText: {
        color: BaseTheme.palette.uiBackground,
        fontSize: 14,
        fontWeight: '700'
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16
    },
    clipCard: {
        backgroundColor: BaseTheme.palette.ui01,
        borderColor: BaseTheme.palette.ui06,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 12,
        padding: 16
    },
    clipTitle: {
        color: BaseTheme.palette.text01,
        fontSize: 17,
        fontWeight: '700'
    },
    container: {
        padding: 24,
        paddingBottom: 40
    },
    menuButton: {
        alignItems: 'center',
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        marginRight: 10,
        width: 36
    },
    menuButtonText: {
        color: BaseTheme.palette.text01,
        fontSize: 28,
        lineHeight: 28,
        marginTop: -2
    },
    menuItem: {
        borderTopColor: BaseTheme.palette.ui06,
        borderTopWidth: 1,
        paddingVertical: 14
    },
    menuItemText: {
        color: BaseTheme.palette.text01,
        fontSize: 16
    },
    menuSheet: {
        backgroundColor: BaseTheme.palette.ui01,
        borderRadius: 18,
        marginHorizontal: 20,
        padding: 18,
        width: '88%'
    },
    menuSheetTitle: {
        color: BaseTheme.palette.text01,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8
    },
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.uiBackground,
        flex: 1,
        justifyContent: 'center'
    },
    path: {
        color: BaseTheme.palette.text02,
        fontSize: 14,
        marginTop: 6
    },
    screen: {
        backgroundColor: BaseTheme.palette.uiBackground,
        flex: 1
    },
    sectionTitle: {
        color: BaseTheme.palette.text01,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20
    },
    secondaryButton: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.ui04,
        borderRadius: 12,
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    secondaryButtonText: {
        color: BaseTheme.palette.text01,
        fontSize: 14,
        fontWeight: '700'
    },
    summaryCard: {
        backgroundColor: BaseTheme.palette.ui01,
        borderColor: BaseTheme.palette.ui06,
        borderRadius: 18,
        borderWidth: 1,
        marginTop: 16,
        padding: 16
    },
    status: {
        color: BaseTheme.palette.text02,
        fontSize: 14,
        marginTop: 10
    },
    subtitle: {
        color: BaseTheme.palette.text02,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8
    },
    title: {
        color: BaseTheme.palette.text01,
        fontSize: 28,
        fontWeight: '700'
    },
    transcript: {
        color: BaseTheme.palette.text01,
        fontSize: 16,
        lineHeight: 22,
        marginTop: 10
    },
    clipTranscript: {
        color: BaseTheme.palette.text01,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 10
    }
});
