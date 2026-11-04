import BaseTheme from '../../base/ui/components/BaseTheme.native';

/**
 * Melp's red, as the client app's red_bg_button and web's Upgrade button.
 */
const UPGRADE_RED = '#EA4335';

/**
 * Melp's dismiss-button grey, as the client app's Remind me later.
 */
const DISMISS_GREY = '#554D4D';

/**
 * The heading grey of web's capping popup.
 */
const TITLE_GREY = '#6B6B6B';

/**
 * Melp's body text colour (the client app's txtblck).
 */
const TEXT_BLACK = '#222020';

const BUTTON = {
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center' as const,
    minHeight: 48,
    paddingHorizontal: BaseTheme.spacing[3],
    paddingVertical: 10
};

const BUTTON_TEXT = {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    includeFontPadding: false,
    lineHeight: 22,
    textAlign: 'center' as const,
    width: '100%'
};

/**
 * The capping popup, styled as Melp's other capping popups: white card, illustration on a light panel, bold heading,
 * the server's message in full, and full-width buttons stacked with the red Upgrade above Remind me later. It stays
 * light in a dark call by design. Nothing is truncated or shrunk: long copy wraps, and the card scrolls if it ever
 * outgrows the screen.
 */
export default {
    actions: {
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: BaseTheme.spacing[3],
        marginTop: BaseTheme.spacing[4],
        width: '100%'
    },

    backdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        bottom: 0,
        justifyContent: 'center',
        left: 0,
        paddingHorizontal: BaseTheme.spacing[3],
        paddingVertical: BaseTheme.spacing[4],
        position: 'absolute',
        right: 0,
        top: 0
    },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        elevation: 12,
        maxHeight: '100%',
        maxWidth: 480,
        padding: BaseTheme.spacing[4],
        shadowColor: '#000000',
        shadowOffset: {
            height: 10,
            width: 0
        },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        width: '100%'
    },

    content: {
        alignItems: 'center',
        width: '100%'
    },

    image: {
        aspectRatio: 508 / 223,
        borderRadius: 12,
        marginBottom: BaseTheme.spacing[4],
        width: '100%'
    },

    message: {
        color: TEXT_BLACK,
        flexShrink: 1,
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        marginTop: BaseTheme.spacing[2],
        textAlign: 'center',
        width: '100%'
    },

    pressed: {
        opacity: 0.85
    },

    primaryButton: {
        ...BUTTON,
        backgroundColor: UPGRADE_RED,
        borderColor: UPGRADE_RED
    },

    primaryButtonText: {
        ...BUTTON_TEXT,
        color: '#FFFFFF'
    },

    scroll: {
        flexGrow: 0,
        flexShrink: 1
    },

    secondaryButton: {
        ...BUTTON,
        backgroundColor: '#FFFFFF',
        borderColor: DISMISS_GREY
    },

    secondaryButtonText: {
        ...BUTTON_TEXT,
        color: DISMISS_GREY
    },

    title: {
        color: TITLE_GREY,
        flexShrink: 1,
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 30,
        textAlign: 'center',
        width: '100%'
    }
};
