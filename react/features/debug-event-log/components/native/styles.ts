import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export default {
    container: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: BaseTheme.shape.borderRadius,
        left: BaseTheme.spacing[2],
        maxHeight: 280,
        position: 'absolute',
        right: BaseTheme.spacing[2],
        top: BaseTheme.spacing[10],
        zIndex: 1002
    },

    header: {
        alignItems: 'center',
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    headerActions: {
        flexDirection: 'row'
    },

    headerButton: {
        marginLeft: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[0]
    },

    headerButtonText: {
        ...BaseTheme.typography.labelBold,
        color: BaseTheme.palette.text01
    },

    titleText: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01
    },

    list: {
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    item: {
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        borderBottomWidth: 1,
        paddingVertical: BaseTheme.spacing[2]
    },

    itemHeader: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01
    },

    itemMeta: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: BaseTheme.palette.text02,
        marginTop: 2
    },

    itemPayload: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: BaseTheme.palette.text03,
        marginTop: BaseTheme.spacing[1]
    },

    footerText: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        color: BaseTheme.palette.text02,
        paddingVertical: BaseTheme.spacing[1],
        textAlign: 'center'
    }
};
