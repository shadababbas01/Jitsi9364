import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export default {
    container: {
        backgroundColor: BaseTheme.palette.ui02,
        flex: 1
    },

    scrollContent: {
        flexGrow: 1,
        padding: BaseTheme.spacing[3]
    },

    header: {
        marginBottom: BaseTheme.spacing[4]
    },

    title: {
        ...BaseTheme.typography.heading4,
        color: BaseTheme.palette.text01,
        marginBottom: BaseTheme.spacing[1]
    },

    description: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02
    },

    section: {
        marginBottom: BaseTheme.spacing[4]
    },

    toggleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },

    toggleLabel: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: BaseTheme.palette.text01
    },

    statusText: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text03,
        marginTop: BaseTheme.spacing[1]
    },

    sectionLabel: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: BaseTheme.palette.text02,
        marginBottom: BaseTheme.spacing[2]
    },

    categoryList: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },

    categoryItem: {
        backgroundColor: BaseTheme.palette.ui04,
        borderColor: BaseTheme.palette.ui05,
        borderRadius: BaseTheme.shape.borderRadius,
        borderWidth: 1,
        marginBottom: BaseTheme.spacing[2],
        marginRight: BaseTheme.spacing[2],
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[2]
    },

    categoryItemActive: {
        borderColor: BaseTheme.palette.ui08,
        backgroundColor: BaseTheme.palette.ui08
    },

    categoryText: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: BaseTheme.palette.text01
    },

    categoryTextActive: {
        color: BaseTheme.palette.text01
    },

    footer: {
        marginTop: 'auto',
        paddingBottom: BaseTheme.spacing[6]
    },

    submitButton: {
        width: '100%'
    }
};