import { IStore } from '../../app/types';
import { showErrorNotification } from '../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../notifications/constants';

import { SET_VIRTUAL_BACKGROUND, SET_VIRTUAL_BACKGROUND_STORED_IMAGES } from './actionTypes';
import {
    BLUR_VALUE,
    PROCESSOR_NAME,
    STORED_IMAGES_LIMIT,
    VIRTUAL_BACKGROUND_TYPE
} from './constants';
import {
    getLocalVideoMediaStreamTrack,
    getVirtualBackgroundState,
    isVirtualBackgroundSupported,
    nativeModule
} from './functions';
import logger from './logger';

/**
 * Stores the background the local participant selected.
 *
 * @param {string} backgroundType - One of {@code VIRTUAL_BACKGROUND_TYPE}.
 * @param {string} [uri] - The image to composite, for the {@code image} type.
 * @param {number} [blurValue] - The blur strength, for the {@code blur} type.
 * @returns {Object}
 */
export function setVirtualBackground(backgroundType: string, uri?: string, blurValue?: number) {
    return {
        type: SET_VIRTUAL_BACKGROUND,
        backgroundType,
        blurValue,
        uri
    };
}

/**
 * Stores the list of backgrounds imported from the device gallery.
 *
 * @param {string[]} storedImages - The image URIs, oldest first.
 * @returns {Object}
 */
export function setStoredImages(storedImages: string[]) {
    return {
        type: SET_VIRTUAL_BACKGROUND_STORED_IMAGES,
        storedImages
    };
}

/**
 * Pushes the currently selected background to the native side and attaches (or detaches) the frame
 * processor on the local camera track.
 *
 * The processor is installed on the capturer's video source, which every consumer of the local
 * camera reads from. That is what makes the background show up in the local thumbnail, in tile
 * view, in the large video and in the stream every remote participant receives, rather than only in
 * one of them.
 *
 * @param {boolean} [notifyOnError] - Whether to surface a notification if the background cannot be
 * loaded. Off when re-applying a remembered background, where the user did not just ask for
 * anything and the image may simply be gone.
 * @returns {Function}
 */
export function applyVirtualBackground(notifyOnError = true) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();

        if (!isVirtualBackgroundSupported(state)) {
            return;
        }

        const { backgroundType, blurValue, uri } = getVirtualBackgroundState(state);
        const enabled = backgroundType !== VIRTUAL_BACKGROUND_TYPE.NONE;

        try {
            // The background is loaded before the processor is attached so that the very first
            // processed frame already has something to composite with.
            await nativeModule.setBackground({
                blurValue: blurValue ?? BLUR_VALUE,
                type: backgroundType,
                uri
            });
        } catch (error) {
            logger.error('Could not load the virtual background', error);
            dispatch(setVirtualBackground(VIRTUAL_BACKGROUND_TYPE.NONE));

            if (notifyOnError) {
                dispatch(showErrorNotification({
                    titleKey: 'virtualBackground.backgroundEffectError'
                }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
            }

            return;
        }

        if (!enabled) {
            // The processor is deliberately left attached. react-native-webrtc's
            // VideoEffectProcessor releases the frame twice when it holds no processors, which
            // takes the frame's refcount negative and crashes the capture thread, and an empty
            // array is the only thing the bridge lets us send to detach. Our processor passes
            // frames through untouched once the mode is `none`, which it now is, so leaving it in
            // place costs a mode check per frame and is the only safe way to turn the effect off.
            return;
        }

        const mediaStreamTrack = getLocalVideoMediaStreamTrack(getState());

        if (!mediaStreamTrack?._setVideoEffects) {
            // The camera is off. The middleware re-applies once a local video track shows up.
            return;
        }

        try {
            mediaStreamTrack._setVideoEffects([ PROCESSOR_NAME ]);
        } catch (error) {
            logger.error('Could not attach the virtual background processor', error);
        }
    };
}

/**
 * Selects a background and applies it.
 *
 * @param {string} backgroundType - One of {@code VIRTUAL_BACKGROUND_TYPE}.
 * @param {string} [uri] - The image to composite, for the {@code image} type.
 * @returns {Function}
 */
export function selectVirtualBackground(backgroundType: string, uri?: string) {
    return (dispatch: IStore['dispatch']) => {
        dispatch(setVirtualBackground(
            backgroundType,
            uri,
            backgroundType === VIRTUAL_BACKGROUND_TYPE.BLUR ? BLUR_VALUE : undefined));

        return dispatch(applyVirtualBackground());
    };
}

/**
 * Opens the device image picker and, if the user picks something, imports it and selects it as the
 * background.
 *
 * @returns {Function}
 */
export function importVirtualBackgroundImage() {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        if (!nativeModule?.pickImage) {
            return;
        }

        let uri;

        try {
            uri = (await nativeModule.pickImage())?.uri;
        } catch (error) {
            logger.error('Could not import an image from the gallery', error);
            dispatch(showErrorNotification({
                titleKey: 'virtualBackground.backgroundEffectError'
            }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));

            return;
        }

        if (!uri) {
            // The user dismissed the picker.
            return;
        }

        const { storedImages } = getVirtualBackgroundState(getState());
        const kept = [ ...storedImages, uri ];

        // Drop the oldest imports past the limit, deleting the copies we made of them.
        while (kept.length > STORED_IMAGES_LIMIT) {
            const dropped = kept.shift();

            try {
                await nativeModule.deleteImage(dropped);
            } catch (error) {
                logger.warn('Could not delete a stored background', error);
            }
        }

        dispatch(setStoredImages(kept));

        return dispatch(selectVirtualBackground(VIRTUAL_BACKGROUND_TYPE.IMAGE, uri));
    };
}

/**
 * Deletes a background previously imported from the gallery, turning the effect off first if it is
 * the one currently in use.
 *
 * @param {string} uri - The image to delete.
 * @returns {Function}
 */
export function deleteVirtualBackgroundImage(uri: string) {
    return async (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const { storedImages, uri: selectedUri } = getVirtualBackgroundState(getState());

        if (selectedUri === uri) {
            await dispatch(selectVirtualBackground(VIRTUAL_BACKGROUND_TYPE.NONE));
        }

        dispatch(setStoredImages(storedImages.filter(stored => stored !== uri)));

        try {
            await nativeModule?.deleteImage(uri);
        } catch (error) {
            logger.warn('Could not delete a stored background', error);
        }
    };
}
