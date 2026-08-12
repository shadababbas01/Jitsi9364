/**
 * The type of the action which stores the background the local participant selected.
 *
 * {
 *     type: SET_VIRTUAL_BACKGROUND,
 *     backgroundType: string,
 *     blurValue: number|undefined,
 *     uri: string|undefined
 * }
 */
export const SET_VIRTUAL_BACKGROUND = 'SET_VIRTUAL_BACKGROUND_NATIVE';

/**
 * The type of the action which stores the list of backgrounds imported from the device gallery.
 *
 * {
 *     type: SET_VIRTUAL_BACKGROUND_STORED_IMAGES,
 *     storedImages: string[]
 * }
 */
export const SET_VIRTUAL_BACKGROUND_STORED_IMAGES = 'SET_VIRTUAL_BACKGROUND_STORED_IMAGES';
