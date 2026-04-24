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
     * Status labels container for large video.
     */
    statusLabelsOnLargeVideo: {
        alignItems: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 80
    },

    /**
     * Status labels container for avatar-only view.
     */
    statusLabelsAboveAvatar: {
        alignItems: 'center',
        marginBottom: 10
    },

    /**
     * Status labels container for avatar-only thumbnails.
     */
    statusLabelsAboveAvatarSmall: {
        alignItems: 'center',
        marginBottom: 6
    },

    /**
     * Status labels container for thumbnails.
     */
    statusLabelsOnThumbnail: {
        alignItems: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 8
    },

    /**
     * Status label pill.
     */
    statusLabelPill: {
        backgroundColor: ColorPalette.darkGrey,
        borderRadius: 12,
        marginBottom: 20,
        paddingHorizontal: 10,
        paddingVertical: 4
    },

    /**
     * Smaller status label pill for thumbnails.
     */
    statusLabelPillSmall: {
        backgroundColor: ColorPalette.darkGrey,
        borderRadius: 10,
        marginBottom: 20,
        paddingHorizontal: 8,
        paddingVertical: 2
    },

    /**
     * Status label text.
     */
    statusLabelText: {
        color: ColorPalette.white,
        fontSize: 12
    },

    /**
     * Smaller status label text for thumbnails.
     */
    statusLabelTextSmall: {
        color: ColorPalette.white,
        fontSize: 10
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
