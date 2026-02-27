import BaseTheme from '../../../base/ui/components/BaseTheme.native';

export default {
    displayNameBackdrop: {
        alignSelf: 'center',
        // backgroundColor: BaseTheme.palette.ui01,     // added by jaswant
        borderRadius: BaseTheme.shape.borderRadius,
        padding: 6
    },

    displayNamePadding: {
        //padding: BaseTheme.spacing[1],
        paddingRight: 6,
        paddingLeft: 6
    },

    displayNameText: {
        color: BaseTheme.palette.text01,
        fontSize: 11,
        fontWeight: 'bold'
    },
        deviceIcon: {
            width: '14px',
            height: '14px',
            fill: '#ffffff',
            opacity: 0.8,
            flexShrink: 0
        }
};
