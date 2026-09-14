import BaseTheme from '../../../../base/ui/components/BaseTheme.native';

/**
 * The size of the icon circles in the toolbox.
 */
const BUTTON_SIZE = 56;

/**
 * The size of the hangup icon circle, larger to stand out as the destructive action.
 */
const HANGUP_BUTTON_SIZE = 64;

/**
 * The size of the callee avatar.
 */
const AVATAR_SIZE = 128;

/**
 * The corner radius of the (rounded-square) callee avatar.
 */
const AVATAR_BORDER_RADIUS = 24;

const iconCircle = {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BUTTON_SIZE / 2,
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE
};

const icon = {
    color: '#ffffff',
    fontSize: 24
};

const iconActive = {
    ...icon,
    color: '#111111'
};

const iconCircleActive = {
    ...iconCircle,
    backgroundColor: '#ffffff'
};

/**
 * The styles of the native components of the audio call screen.
 */
export default {

    conference: {
        backgroundColor: BaseTheme.palette.uiBackground,
        flex: 1,
        justifyContent: 'space-between'
    },

    calleeArea: {
        flex: 1
    },

    calleeDetailsContainer: {
        alignItems: 'center',
        flex: 1
    },

    identityContainer: {
        alignItems: 'center',
        paddingHorizontal: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[5]
    },

    presenceContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center'
    },

    avatar: {
        marginBottom: BaseTheme.spacing[3]
    },

    calleeName: {
        ...BaseTheme.typography.heading5,
        color: BaseTheme.palette.text01,

        // Keep the text at its intrinsic width because embedded Android hosts can clip a glyph
        // when the label is allowed to shrink to its flex column's measured width.
        includeFontPadding: false,
        flexShrink: 0,
        textAlign: 'center'
    },

    encryptedRow: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: BaseTheme.spacing[1]
    },

    encryptedIcon: {
        color: BaseTheme.palette.text02,
        fontSize: 14,
        marginRight: BaseTheme.spacing[1]
    },

    encryptedText: {
        ...BaseTheme.typography.labelRegular,
        color: BaseTheme.palette.text02,
        includeFontPadding: false,
        flexShrink: 0
    },

    connectionStatus: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        includeFontPadding: false,
        flexShrink: 0,
        marginTop: BaseTheme.spacing[1],
        textAlign: 'center'
    },

    roomTimer: {
        ...BaseTheme.typography.bodyShortRegular,
        color: BaseTheme.palette.text02,
        includeFontPadding: false,
        flexShrink: 0,
        marginTop: BaseTheme.spacing[1],
        textAlign: 'center'
    },

    toolboxContainer: {
        alignItems: 'stretch',
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        paddingBottom: BaseTheme.spacing[4],
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[3]
    },

    toolboxRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: BaseTheme.spacing[4]
    },

    toolboxColumn: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: BaseTheme.spacing[1]
    },

    toolboxCaption: {
        ...BaseTheme.typography.labelRegular,
        color: BaseTheme.palette.text01,
        includeFontPadding: false,
        flexShrink: 0,
        marginTop: BaseTheme.spacing[1],
        textAlign: 'center'
    },

    iconCircle,

    iconCircleDisabled: {
        ...iconCircle,
        opacity: 0.4
    },

    icon,

    iconActive,

    iconCircleActive,

    iconDisabled: {
        ...icon,
        opacity: 0.4
    },

    overflowButton: {
        ...iconCircle,
        position: 'absolute',
        right: BaseTheme.spacing[3],
        top: BaseTheme.spacing[3],
        zIndex: 10
    },

    hangupCircle: {
        ...iconCircle,
        backgroundColor: BaseTheme.palette.actionDanger,
        borderRadius: HANGUP_BUTTON_SIZE / 2,
        height: HANGUP_BUTTON_SIZE,
        width: HANGUP_BUTTON_SIZE
    },

    hangupIcon: {
        ...icon,
        color: BaseTheme.palette.icon01
    },

    squareAvatar: {
        borderRadius: AVATAR_BORDER_RADIUS
    },

    avatarStyles: {
        size: AVATAR_SIZE
    }
};
