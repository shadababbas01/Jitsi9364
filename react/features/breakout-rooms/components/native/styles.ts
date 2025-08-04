import BaseTheme from '../../../base/ui/components/BaseTheme.native';


/**
 * The styles of the native components of the feature {@code breakout rooms}.
 */
export default {
    centeredContainer: {
        width: '100%' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const
    },
    button: {
        width: '85%' ,
        backgroundColor: '#ee4136' // added by Shadab
    },
    breakoutroombutton: {
        marginBottom: BaseTheme.spacing[2],
        marginTop: BaseTheme.spacing[2],
        marginHorizontal: BaseTheme.spacing[2],
        width: '85%' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const
    },

    collapsibleList: {
        alignItems: 'center',
        borderRadius: BaseTheme.shape.borderRadius,
        display: 'flex',
        flexDirection: 'row',
        height: BaseTheme.spacing[7],
        marginHorizontal: BaseTheme.spacing[2],
        marginTop: BaseTheme.spacing[3]
    },

    arrowIcon: {
        backgroundColor: BaseTheme.palette.ui03,
        height: BaseTheme.spacing[5],
        width: BaseTheme.spacing[5],
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },

    roomName: {
        fontSize: 15,
        color: BaseTheme.palette.text01,
        fontWeight: 'bold',
        marginLeft: BaseTheme.spacing[2]
    },

    listTile: {
        fontSize: 15,
        color: BaseTheme.palette.text01,
        fontWeight: 'bold',
        marginLeft: BaseTheme.spacing[2]
    },

    autoAssignLabel: {
        color: BaseTheme.palette.link01
    },

    autoAssignButton: {
        alignSelf: 'center',
        justifyContent: 'center',
        marginTop: BaseTheme.spacing[3]
    },

    breakoutRoomsContainer: {
        backgroundColor: BaseTheme.palette.ui01,
        alignSelf: 'center',
        flex: 1,
        flexDirection: 'column',
        height: 'auto',
        paddingHorizontal: BaseTheme.spacing[3]
    },
    breakoutRoomsContaineroverflowmenu: {
        backgroundColor: BaseTheme.palette.ui01,
        alignSelf: 'center',
        width: '100%', // Fill the full device width
        flex: 1,
        flexDirection: 'column',
        height: 'auto',
        paddingHorizontal: BaseTheme.spacing[0]
    },

    inputContainer: {
        marginLeft: BaseTheme.spacing[2],
        marginRight: BaseTheme.spacing[2],
        marginTop: BaseTheme.spacing[4]
    },

    centerInput: {
        paddingRight: BaseTheme.spacing[3],
        textAlign: 'center'
    }
};
