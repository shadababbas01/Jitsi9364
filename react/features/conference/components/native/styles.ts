import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export const INSECURE_ROOM_NAME_LABEL_COLOR = BaseTheme.palette.actionDanger;

const TITLE_BAR_BUTTON_SIZE = 24;
const ROUND_BUTTON_SIZE = 48;


/**
 * The styles of the safe area view that contains the title bar.
 */
const titleBarSafeView = {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
};

const alwaysOnTitleBar = {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, .5)',
    borderRadius: BaseTheme.shape.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: BaseTheme.spacing[3],
    paddingRight: BaseTheme.spacing[0],
    '&:not(:empty)': {
        padding: BaseTheme.spacing[1]
    }
};

/**
 * The styles of the feature conference.
 */
export default {

    /**
     * {@code Conference} Style.
     */
    conference: {
        alignSelf: 'stretch',
        backgroundColor: BaseTheme.palette.uiBackground,
        flex: 1
    },

    displayNameContainer: {
        margin: BaseTheme.spacing[3]
    },

    connectionStatusContainer: {
        alignSelf: 'center',
        marginTop: BaseTheme.spacing[1]
    },

    connectionStatusOverlay: {
        alignItems: 'center',
        paddingTop: BaseTheme.spacing[2]
    },

    connectionStatusText: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01,
        marginTop: 2,
        textAlign: 'center'
    },

    /**
     * View that contains the indicators.
     */
    indicatorContainer: {
        flex: 1,
        flexDirection: 'row'
    },

    titleBarButtonContainer: {
        borderRadius: 3,
        height: BaseTheme.spacing[7],
        marginTop: BaseTheme.spacing[1],
        marginRight: BaseTheme.spacing[1],
        zIndex: 1,
        width: BaseTheme.spacing[7]
    },

    titleBarButton: {
        iconStyle: {
            color: BaseTheme.palette.icon01,
            padding: 12,
            fontSize: TITLE_BAR_BUTTON_SIZE
        },
        underlayColor: 'transparent'
    },

    lonelyMeetingContainer: {
        alignSelf: 'stretch',
        alignItems: 'center',
        padding: BaseTheme.spacing[3]
    },

    lonelyMessage: {
        color: BaseTheme.palette.text01,
        paddingVertical: BaseTheme.spacing[2]
    },

    pipButtonContainer: {
        '&:not(:empty)': {
            borderRadius: 3,
            height: BaseTheme.spacing[7],
            marginTop: BaseTheme.spacing[1],
            marginLeft: BaseTheme.spacing[1],
            zIndex: 1,
            width: BaseTheme.spacing[7]
        }
    },

    pipButton: {
        iconStyle: {
            color: BaseTheme.palette.icon01,
            padding: 12,
            fontSize: TITLE_BAR_BUTTON_SIZE
        },
        underlayColor: 'transparent'
    },

    titleBarSafeViewColor: {
        ...titleBarSafeView,
    },

    titleBarSafeViewTransparent: {
        ...titleBarSafeView
    },

    titleBarWrapper: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[2]
    },

    titleBarLeft: {
        alignItems: 'flex-start',
        width: 66
    },

    titleBarCenter: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: BaseTheme.spacing[2]
    },

    titleBarRightSpacer: {
        width: ROUND_BUTTON_SIZE
    },

    titleBarLabels: {
        marginTop: BaseTheme.spacing[2]
    },

    titleBarRoundButton: {
        iconStyle: {
            color: BaseTheme.palette.icon01,
            fontSize: TITLE_BAR_BUTTON_SIZE
        },
        style: {
            alignItems: 'center',
            backgroundColor: '#4949498f', 
            borderRadius: ROUND_BUTTON_SIZE / 2,
            height: ROUND_BUTTON_SIZE,
            justifyContent: 'center',
            width: ROUND_BUTTON_SIZE
        },
        underlayColor: 'transparent'
    },

    meetingName: {
        ...BaseTheme.typography.heading6,
        color: BaseTheme.palette.text01,
        textAlign: 'center'
    },

    meetingTimer: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01,
        marginTop: 2,
        textAlign: 'center'
    },

    alwaysOnTitleBar: {
        ...alwaysOnTitleBar,
        marginRight: BaseTheme.spacing[2]
    },

    alwaysOnTitleBarWide: {
        ...alwaysOnTitleBar,
        marginRight: BaseTheme.spacing[12]
    },

    expandedLabelWrapper: {
        zIndex: 1
    },

    roomTimer: {
        ...BaseTheme.typography.bodyShortBold,
        color: BaseTheme.palette.text01,
        lineHeight: 14,
        textAlign: 'center'
    },

    roomTimerView: {
        backgroundColor: BaseTheme.palette.ui03,
        borderRadius: BaseTheme.shape.borderRadius,
        height: 32,
        justifyContent: 'center',
        paddingHorizontal: BaseTheme.spacing[2],
        paddingVertical: BaseTheme.spacing[1],
        minWidth: 50
    },

    roomName: {
        color: BaseTheme.palette.text01,
        ...BaseTheme.typography.bodyShortBold,
        paddingVertical: 6
    },

    roomNameView: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderBottomLeftRadius: 3,
        borderTopLeftRadius: 3,
        flexShrink: 1,
        justifyContent: 'center',
        paddingHorizontal: 10
    },

    roomNameWrapper: {
        flexDirection: 'row',
        marginRight: 10,
        marginLeft: 8,
        flexShrink: 1,
        flexGrow: 1
    },

    /**
     * The style of the {@link View} which expands over the whole
     * {@link Conference} area and splits it between the {@link Filmstrip} and
     * the {@link Toolbox}.
     */
    toolboxAndFilmstripContainer: {
        bottom: 0,
        flexDirection: 'column',
        justifyContent: 'flex-end',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0
    },


    sideToolbar: {
        position: 'absolute',
        right: BaseTheme.spacing[4],
        top: BaseTheme.spacing[2],
        zIndex: 2
    },

    sideToolbarStack: {
        alignItems: 'center'
    },

    sideToolbarButtonWrapper: {
        marginBottom: BaseTheme.spacing[3],
    },

    sideToolbarButtonBadgeWrapper: {
        alignItems: 'center',
        backgroundColor: '#16253a',
        borderColor: '#4c8dff',
        borderRadius: 24,
        borderWidth: 2,
        height: 48,
        justifyContent: 'center',
        position: 'relative',
        width: 60
    },

    sideToolbarButton: {
        iconStyle: {
            color: BaseTheme.palette.icon01,
            fontSize: TITLE_BAR_BUTTON_SIZE
        },
        style: {
            alignItems: 'center',
            backgroundColor: '#494949ff',
            borderRadius: 60 / 2,
            height: 60,
            justifyContent: 'center',
            width: 60
        },
        underlayColor: 'transparent'
    },
    
    sideToolbarButtonRaiseHand: {
        iconStyle: {
            color: '#8bc1ff',
            fontSize: 22
        },
        style: {
            alignItems: 'flex-start',
            backgroundColor: 'transparent',
            borderRadius: 24,
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            paddingLeft: 7,
            position: 'absolute',
            right: 0,
            top: 0
        },
        underlayColor: 'transparent'
    },

    sideToolbarBadge: {
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        minWidth: 16,
        position: 'absolute',
        right: 7,
        top: 0
    },

    sideToolbarBadgeText: {
        color: '#ffffff',
        ...BaseTheme.typography.bodyShortBold,
        textAlign: 'center'
    },
sideToolbarBadgeTextRaiseHand: {
    backgroundColor: BaseTheme.palette.ui03,
    borderRadius: BaseTheme.spacing[2],
    borderColor: 'white',
    overflow: 'hidden',
    height: 18,
    minWidth: 18,
    color: BaseTheme.palette.text01,
    ...BaseTheme.typography.labelBold,
    position: 'absolute',
    right: 4,   // inside
    top: 4,     // inside
    textAlign: 'center',
    paddingHorizontal: 2
},

    insecureRoomNameLabel: {
        backgroundColor: INSECURE_ROOM_NAME_LABEL_COLOR,
        borderRadius: BaseTheme.shape.borderRadius,
        height: 32
    },

    raisedHandsCountLabel: {
        alignItems: 'center',
        backgroundColor: BaseTheme.palette.warning02,
        borderRadius: BaseTheme.shape.borderRadius,
        flexDirection: 'row',
        marginBottom: BaseTheme.spacing[0],
        marginLeft: BaseTheme.spacing[0]
    },

    raisedHandsCountLabelText: {
        color: BaseTheme.palette.uiBackground,
        paddingLeft: BaseTheme.spacing[2]
    }
};
