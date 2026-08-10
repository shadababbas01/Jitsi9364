import { ColorPalette } from '../../../base/styles/components/styles/ColorPalette';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';
import { SMALL_THUMBNAIL_SIZE } from '../../constants';

/**
 * Size for the Avatar.
 */
export const AVATAR_SIZE = 50;

const indicatorContainer = {
    alignItems: 'center',
    // backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: BaseTheme.shape.borderRadius,
    height: 24,
    margin: 2,
    padding: 2
};


/**
 * The styles of the feature filmstrip.
 */
export default {

    /**
     * The FlatList content container styles.
     */
    contentContainer: {
        alignItems: 'stretch',
        flexGrow: 1,
        justifyContent: 'flex-start'
    },

    /**
     * The display name container.
     */
    displayNameContainer: {
        padding: 2
    },

    /**
     * The style of the narrow {@link Filmstrip} version which displays
     * thumbnails in a row at the bottom of the screen.
     */
    filmstripNarrow: {
        flexDirection: 'row',
        flexGrow: 0,
        justifyContent: 'flex-end',
        margin: 6
    },
        filmstripToolboxHidden: {
        flexDirection: 'row',
        flexGrow: 0,
        justifyContent: 'flex-end',
        margin: 50
    },

    /**
     * The style of the wide {@link Filmstrip} version which displays thumbnails
     * in a column on the short size of the screen.
     *
     * NOTE: width is calculated based on the children, but it should also align
     * to {@code FILMSTRIP_SIZE}.
     */
    filmstripWide: {
        bottom: BaseTheme.spacing[0],
        flexDirection: 'column',
        flexGrow: 0,
        position: 'absolute',
        right: BaseTheme.spacing[0],
        top: BaseTheme.spacing[0]
    },

    filmstripWideLeft: {
        left: BaseTheme.spacing[0],
        right: undefined
    },

    /**
     * The styles for the FlatList container.
     */
    flatListContainer: {
        flex: 1
    },

    /**
     * The styles for the FlatList component in stage view.
     */
    flatListStageView: {
        flexGrow: 0
    },

    /**
     * The styles for the FlatList component in tile view.
     */
    flatListTileView: {
        flex: 1
    },

    tileGridContainer: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start'
    },

    tileRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%'
    },

    pageIndicatorContainer: {
        position: 'absolute',
        bottom: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#494949ff',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 8
    },

    pageIndicatorDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ffffff',
        opacity: 0.35,
        marginHorizontal: 3
    },

    pageIndicatorDotActive: {
        opacity: 1
    },

    /**
     * Container of the {@link LocalThumbnail}.
     */
    localThumbnail: {
        alignContent: 'stretch',
        alignSelf: 'stretch',
        aspectRatio: 1,
        flexShrink: 0,
        flexDirection: 'row'
    },

    /**
     * The style of a participant's Thumbnail which renders either the video or
     * the avatar of the associated participant.
     */
    thumbnail: {
        alignItems: 'stretch',
        backgroundColor: BaseTheme.palette.ui02,
        borderColor: BaseTheme.palette.ui03,
        borderRadius:6,
        borderStyle: 'solid',
        borderWidth: 1,
        flex: 1,
        height: SMALL_THUMBNAIL_SIZE,
        justifyContent: 'center',
        margin: 2,
        maxHeight: SMALL_THUMBNAIL_SIZE,
        maxWidth: SMALL_THUMBNAIL_SIZE,
        overflow: 'hidden',
        position: 'relative',
        width: SMALL_THUMBNAIL_SIZE
    },

    indicatorContainer: {
        ...indicatorContainer
    },

    screenShareIndicatorContainer: {
        ...indicatorContainer
    },

    /**
     * The thumbnail indicator container.
     */
    thumbnailIndicatorContainer: {
        ...indicatorContainer,
        bottom: 3,
        flex: 1,
        flexDirection: 'row',
        left: 3,
        position: 'absolute',
        maxWidth: '95%',
        overflow: 'hidden',
        padding: BaseTheme.spacing[0]
    },

    bottomIndicatorsContainer: {
        flexDirection: 'row',
        padding: BaseTheme.spacing[1]
    },

    thumbnailTopLeftIndicatorContainer: {
        ...indicatorContainer,
        // backgroundColor: 'unset',
        flexDirection: 'row',
        position: 'absolute',
        top: BaseTheme.spacing[1]
    },

    raisedHandIndicator: {
        ...indicatorContainer,
        alignItems: 'center',
        backgroundColor: '#16253a',
        borderColor: '#4c8dff',
        borderRadius: 24,
        borderWidth: 2,
        height: 28,
        justifyContent: 'center',
        width: 40
    },

    raisedHandIcon: {
        color: '#8bc1ff',
        fontSize: 22
    },

    thumbnailRaisedHand: {
        borderWidth: 2,
        borderColor: '#4c8dff'
    },

    thumbnailDominantSpeaker: {
        borderWidth: 2,
        borderColor: ColorPalette.red
    },

    /**
     * Sits with the red outline, so that the tile says who is being recorded and not only that somebody is.
     */
    thumbnailRecordingBadge: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        borderColor: ColorPalette.red,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        maxWidth: '70%',
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[1],
        position: 'absolute',
        top: BaseTheme.spacing[2],
        zIndex: 5
    },

    thumbnailRecordingBadgeDot: {
        backgroundColor: ColorPalette.red,
        borderRadius: 4,
        height: 8,
        marginRight: BaseTheme.spacing[1],
        width: 8
    },

    thumbnailRecordingBadgeText: {
        ...BaseTheme.typography.labelBold,
        color: ColorPalette.white,
        letterSpacing: 0
    },

    thumbnailGif: {
        flexGrow: 1,
        resizeMode: 'contain'
    },
    thumbnailVideoClip: {
        flex: 1,
        borderRadius: BaseTheme.shape.borderRadius,
        overflow: 'hidden',
        backgroundColor: BaseTheme.palette.ui02
    },
    indicator: {
        backgroundColor: 'red',
        //padding: 2,
        color: ColorPalette.white,
        fontSize: 14,
        //textShadowColor: ColorPalette.black,
        textShadowOffset: {
            height: -1,
            width: 0
        }
    },

    voiceIndicatorContainer: {
        bottom: 18,
        left: 0,
        position: 'absolute',
        right: 0,
        alignItems: 'center',
        justifyContent: 'center'
    },

    voiceIndicatorRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center'
    },

    voiceLine: {
        backgroundColor: '#ffffff',
        borderRadius: 3,
        marginHorizontal: 3,
        width: 6
    }
};
