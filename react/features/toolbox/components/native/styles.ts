import ColorSchemeRegistry from '../../../base/color-scheme/ColorSchemeRegistry';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';

// Toolbox, toolbar:

/**
 * The style of toolbar buttons.
 */
const toolbarButton = {
    alignItems: 'center',
    borderRadius: 29,
    borderWidth: 0,
    flex: 0,
    flexDirection: 'row',
    height: 50,
    justifyContent: 'center',
    marginHorizontal: 6,
    marginVertical: 0,
    width: 50
};

/**
 * The icon style of the toolbar buttons.
 */
const toolbarButtonIcon = {
    alignSelf: 'center',
    color: BaseTheme.palette.icon04,
    fontSize: 27
};


/**
 * The icon style of toolbar buttons which display white icons.
 */
const whiteToolbarButtonIcon = {
    ...toolbarButtonIcon,
    color: BaseTheme.palette.icon01
};

/**
 * The style of reaction buttons.
 */
const reactionButton = {
    ...toolbarButton,
    backgroundColor: 'transparent',
    alignItems: 'center',
    marginTop: 0,
    marginHorizontal: 0
};

const gifButton = {
    ...reactionButton,
    backgroundColor: '#000'
};

/**
 * The style of the emoji on the reaction buttons.
 */
const reactionEmoji = {
    fontSize: 20,
    color: BaseTheme.palette.icon01
};

const reactionMenu = {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BaseTheme.palette.ui01
};

/**
 * The Toolbox and toolbar related styles.
 */
const styles = {

    sheetGestureRecognizer: {
        alignItems: 'stretch',
        flexDirection: 'column'
    },

    /**
     * The style of the toolbar.
     */
    toolbox: {
        alignSelf: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(62, 62, 66, 0.78)',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 40,
        borderWidth: 1,
        width: '80%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[2]
    },

    toolboxSafeArea: {
        alignSelf: 'center'
    },

    /**
     * The style of the root/top-level container of {@link Toolbox}.
     */
    toolboxContainer: {
        alignItems: 'center',
        backgroundColor: 'blur',
        flexDirection: 'column',
        maxWidth: 500,
        marginHorizontal: 'auto',
        marginVertical: BaseTheme.spacing[3],
        paddingHorizontal: 0,
        width: '100%'
    },

    toolboxButtonIconContainer: {
        alignItems: 'center',
        borderRadius: BaseTheme.shape.borderRadius,
        height: BaseTheme.spacing[7],
        justifyContent: 'center',
        width: BaseTheme.spacing[7]
    }
};

export default styles;

/**
 * Color schemed styles for the @{Toolbox} component.
 */
ColorSchemeRegistry.register('Toolbox', {
    /**
     * Styles for buttons in the toolbar.
     */
    buttonStyles: {
        iconStyle: toolbarButtonIcon,
        style: toolbarButton
    },

    buttonStylesBorderless: {
        iconStyle: whiteToolbarButtonIcon,
        style: {
            ...toolbarButton,
            backgroundColor: 'transparent'
        },
        underlayColor: 'transparent'
    },

    backgroundToggle: {
        backgroundColor: BaseTheme.palette.ui04
    },

    hangupMenuContainer: {
        marginHorizontal: BaseTheme.spacing[2],
        marginVertical: BaseTheme.spacing[2]
    },

    hangupButton: {
        flex: 1,
        marginHorizontal: BaseTheme.spacing[2],
        marginVertical: BaseTheme.spacing[2]
    },

    hangupButtonStyles: {
        iconStyle: whiteToolbarButtonIcon,
        style: {
            ...toolbarButton,
            backgroundColor: '#FF3B30',
            borderRadius: 24
        },
        underlayColor: '#FF3B30'
    },

    reactionDialog: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent'
    },

    overflowReactionMenu: {
        ...reactionMenu,
        padding: BaseTheme.spacing[2]
    },

    reactionMenu: {
        ...reactionMenu,
        paddingHorizontal: BaseTheme.spacing[3],
        borderRadius: 3,
        width: 360
    },

    reactionRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },

    reactionButton: {
        gifButton,
        style: reactionButton,
        underlayColor: BaseTheme.palette.ui04,
        emoji: reactionEmoji
    },

    emojiAnimation: {
        color: BaseTheme.palette.icon01,
        position: 'absolute',
        zIndex: 1001,
        elevation: 2,
        fontSize: 20,
        left: '50%',
        top: '100%'
    },

    /**
     * Styles for toggled buttons in the toolbar.
     */
    toggledButtonStyles: {
        iconStyle: whiteToolbarButtonIcon,
        style: {
            ...toolbarButton
        },
        underlayColor: 'transparent'
    }
});
