import BaseTheme from '../../../base/ui/components/BaseTheme.native';

/**
 * Gutter between two background tiles.
 */
const TILE_SPACING = BaseTheme.spacing[2];

export default {

    container: {
        backgroundColor: BaseTheme.palette.ui01,
        flex: 1
    },

    /**
     * Wraps the tiles into rows of three.
     */
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingBottom: BaseTheme.spacing[4],
        paddingHorizontal: TILE_SPACING / 2
    },

    sectionLabel: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        paddingBottom: TILE_SPACING / 2,
        paddingHorizontal: TILE_SPACING,
        paddingTop: BaseTheme.spacing[3]
    },

    /**
     * Owns the width so that the gutters do not push three tiles per row down to two, which is what
     * happens when a margin is added to a percentage width.
     */
    tileWrapper: {
        padding: TILE_SPACING / 2,
        width: '33.333%'
    },

    tile: {
        aspectRatio: 1,
        borderColor: 'transparent',
        borderRadius: BaseTheme.shape.borderRadius,
        borderWidth: 2,
        overflow: 'hidden'
    },

    tileSelected: {
        borderColor: BaseTheme.palette.action01
    },

    /**
     * Fills a tile which has no image of its own: none, blur and the gallery button.
     */
    tilePlaceholder: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.ui03,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: BaseTheme.spacing[1]
    },

    tileImage: {
        flex: 1
    },

    tileLabel: {
        ...BaseTheme.typography.bodyShortRegularSmall,
        alignSelf: 'stretch',
        color: BaseTheme.palette.text01,
        flexShrink: 1,
        includeFontPadding: false,
        marginTop: BaseTheme.spacing[1],
        paddingHorizontal: BaseTheme.spacing[1],
        textAlign: 'center'
    },

    /**
     * The check mark drawn over the tile which is in use.
     */
    tileCheck: {
        backgroundColor: BaseTheme.palette.action01,
        borderRadius: BaseTheme.shape.circleRadius,
        padding: 2,
        position: 'absolute',
        right: BaseTheme.spacing[1],
        top: BaseTheme.spacing[1]
    },

    /**
     * The delete affordance drawn over imported tiles.
     */
    tileDelete: {
        backgroundColor: BaseTheme.palette.ui02,
        borderRadius: BaseTheme.shape.circleRadius,
        left: BaseTheme.spacing[1],
        padding: 2,
        position: 'absolute',
        top: BaseTheme.spacing[1]
    },

    unsupported: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        padding: BaseTheme.spacing[3],
        textAlign: 'center'
    }
};
