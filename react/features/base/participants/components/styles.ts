import { BoxModel } from '../../styles/components/styles/BoxModel';
import { ColorPalette } from '../../styles/components/styles/ColorPalette';

/**
 * The styles of the feature base/participants.
 */
export default {
    /**
     * Container for the avatar in the view.
     */
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center'
    },

    /**
     * Style for the text rendered when there is a connectivity problem.
     */
    connectionInfoText: {
        color: ColorPalette.white,
        fontSize: 12,
        marginVertical: BoxModel.margin,
        marginHorizontal: BoxModel.margin,
        textAlign: 'center'
    },

    /**
     * Style for the container of the text rendered when there is a
     * connectivity problem.
     */
    connectionInfoContainer: {
        alignSelf: 'center',
        backgroundColor: ColorPalette.darkGrey,
        borderRadius: 20,
        marginTop: BoxModel.margin
    },

    /**
     * {@code ParticipantView} Style.
     */
    participantView: {
        alignItems: 'stretch',
        flex: 1,
        justifyContent: 'center'
    },

    /**
     * Smaller audio indicator container style for thumbnails.
     */
    audioIndicatorStyleSmall: {
        bottom: 12,
        transform: [ { scaleX: 0.6 }, { scaleY: 0.4 } ]
    },

    /**
     * Places the audio indicator just below the avatar.
     */
    audioIndicatorStyleBelowAvatar: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: '25%'
    }
};
