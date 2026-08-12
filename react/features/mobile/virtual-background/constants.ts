/**
 * An enumeration of the different virtual background types.
 *
 * @enum {string}
 */
export const VIRTUAL_BACKGROUND_TYPE = {
    BLUR: 'blur',
    IMAGE: 'image',
    NONE: 'none'
} as const;

/**
 * The name the Android SDK registers the frame processor under with react-native-webrtc. It is what
 * gets handed to {@code MediaStreamTrack._setVideoEffect()} to switch the effect on.
 */
export const PROCESSOR_NAME = 'JitsiVirtualBackground';

/**
 * The blur strength applied when background blur is selected. Matches the value the web client
 * uses for its regular (as opposed to slight) blur.
 */
export const BLUR_VALUE = 25;

/**
 * The maximum number of gallery images kept around. Importing another one past this limit drops the
 * oldest, which keeps the picker usable and the app's storage bounded.
 */
export const STORED_IMAGES_LIMIT = 12;

/**
 * A background the user can pick.
 */
export interface IVirtualBackgroundImage {

    /**
     * Stable identifier, also used as the React key.
     */
    id: string;

    /**
     * Whether the image was imported from the device gallery, as opposed to being bundled with the
     * app. Only imported images can be deleted.
     */
    stored?: boolean;

    /**
     * Where the image lives. Both the picker thumbnails and the native frame processor read it, so
     * it has to be a URI both understand.
     */
    uri: string;
}

/**
 * The backgrounds bundled with the app.
 *
 * These are the same pictures the web client ships, copied into the Android SDK's assets so that
 * the native frame processor can decode them. React Native's {@code Image} understands the
 * {@code file:///android_asset/} form as well, which lets the picker show a thumbnail off the very
 * same URI that gets composited.
 */
export const BUNDLED_IMAGES: IVirtualBackgroundImage[] = [ 1, 2, 3, 4, 5, 6, 7 ].map(index => ({
    id: `bundled-${index}`,
    uri: `file:///android_asset/virtual-background/background-${index}.jpg`
}));
