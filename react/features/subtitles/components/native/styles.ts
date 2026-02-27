import { BoxModel } from '../../../base/styles/components/styles/BoxModel';
import {
    ColorPalette
} from '../../../base/styles/components/styles/ColorPalette';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';

/**
 * The styles of the React {@code Component}s of the feature subtitles.
 */
export default {
    languageItemWrapper: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row'
    },

    iconWrapper: {
        width: 32
    },

    activeLanguageItemText: {
        ...BaseTheme.typography.bodyShortBoldLarge
    },

    languageItemText: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: BaseTheme.palette.text01,
        marginLeft: BaseTheme.spacing[2],
        marginVertical: BaseTheme.spacing[2]
    },

    subtitlesContainer: {
        backgroundColor: BaseTheme.palette.ui01,
        flex: 1
    },

    /**
     * Style for subtitle paragraph.
     */
    captionsSubtitles: {
        backgroundColor: ColorPalette.black,
        borderRadius: BoxModel.margin / 4,
        color: ColorPalette.white,
        marginBottom: BoxModel.margin,
        padding: BoxModel.padding / 2
    },

    /**
     * Style for the subtitles container.
     */
    captionsSubtitlesContainer: {
        alignItems: 'center',
        flexDirection: 'column',
        flexGrow: 0,
        justifyContent: 'flex-end',
        margin: BoxModel.margin
    },

    itemsContainer: {
        marginHorizontal: BaseTheme.spacing[4],
        marginVertical: BaseTheme.spacing[4]
            },
    scrollContent: {
        flexGrow: 1
    },
    header: {
        paddingHorizontal: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[4]
    },
    headerTitle: {
        ...BaseTheme.typography.heading4,
        color: BaseTheme.palette.text01
    },
    headerSubtitle: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: BaseTheme.palette.text02,
        marginTop: BaseTheme.spacing[1]
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[4],
        marginTop: BaseTheme.spacing[4]
    },
    button: {
        flex: 1,
        marginHorizontal: BaseTheme.spacing[1]
    },
    languageListSection: {
        marginTop: BaseTheme.spacing[2]
    },
    historySection: {
        borderTopColor: BaseTheme.palette.ui03,
        borderTopWidth: 1,
        margin: BaseTheme.spacing[4],
        marginTop: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[2]
    },
    historyTitle: {
        ...BaseTheme.typography.bodyShortBoldLarge,
        color: BaseTheme.palette.text01,
        marginBottom: BaseTheme.spacing[2]
    },
    historyItem: {
        ...BaseTheme.typography.bodyShortRegularLarge,
        color: BaseTheme.palette.text01,
        marginBottom: BaseTheme.spacing[1]
    },
    historyEmpty: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        fontStyle: 'italic'
    }
};
