import BaseTheme from '../../../base/ui/components/BaseTheme.native';

const contentColumn = {
    flex: 1,
    flexDirection: 'column',
    paddingLeft: BaseTheme.spacing[2]
};

const notification = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 22,
    display: 'flex',
    flexDirection: 'row',
    marginVertical: BaseTheme.spacing[1],
    maxWidth: 360,
    paddingHorizontal: BaseTheme.spacing[3],
    paddingVertical: BaseTheme.spacing[1],
    width: '100%'
};

/**
 * The styles of the React {@code Components} of the feature notifications.
 */
export default {

    /**
     * The content (left) column of the notification.
     */
    interactiveContentColumn: {
        ...contentColumn
    },

    contentColumn: {
        ...contentColumn,
        justifyContent: 'center'
    },

    /**
     * Test style of the notification.
     */

    contentContainer: {
        paddingHorizontal: BaseTheme.spacing[2]
    },

    contentText: {
        color: BaseTheme.palette.text01,
        paddingLeft: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[1]
    },

    contentTextDescription: {
        color: BaseTheme.palette.text01,
        paddingLeft: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[2]
    },

    contentTextTitleDescription: {
        color: BaseTheme.palette.text01,
        fontWeight: 'bold',
        paddingLeft: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[2]
    },

    contentTextTitle: {
        color: BaseTheme.palette.text01,
        fontWeight: 'bold',
        paddingLeft: BaseTheme.spacing[4],
        paddingTop: BaseTheme.spacing[3]
    },

    /**
     * Dismiss icon style.
     */
    dismissIcon: {
        color: BaseTheme.palette.icon04,
        fontSize: 20
    },

    notification: {
        ...notification
    },

    notificationWithDescription: {
        ...notification,
        paddingBottom: BaseTheme.spacing[2]
    },

    /**
     * Wrapper for the message.
     */
    notificationContent: {
        alignItems: 'center',
        flexDirection: 'row'
    },

    participantName: {
        color: BaseTheme.palette.text01,
        overflow: 'hidden'
    },

    iconContainer: {
        position: 'absolute',
        left: BaseTheme.spacing[2],
        top: 12
    },

    btn: {
        paddingLeft: BaseTheme.spacing[3]
    },

    btnContainer: {
        display: 'flex',
        flexDirection: 'row',
        paddingLeft: BaseTheme.spacing[3],
        paddingTop: BaseTheme.spacing[1]
    },

    withToolbox: {
        alignItems: 'center',
        paddingHorizontal: BaseTheme.spacing[3],
        position: 'absolute',
        top: BaseTheme.spacing[12],
        width: '100%'
    },

    withToolboxTileView: {
        alignItems: 'center',
        paddingHorizontal: BaseTheme.spacing[3],
        position: 'absolute',
        top: BaseTheme.spacing[12],
        width: '100%'
    },

    withoutToolbox: {
        alignItems: 'center',
        paddingHorizontal: BaseTheme.spacing[3],
        position: 'absolute',
        top: BaseTheme.spacing[6],
        width: '100%'
    },

    withoutToolboxTileView: {
        alignItems: 'center',
        paddingHorizontal: BaseTheme.spacing[3],
        position: 'absolute',
        top: BaseTheme.spacing[6],
        width: '100%'
    }
};
