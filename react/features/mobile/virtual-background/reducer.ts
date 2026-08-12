import PersistenceRegistry from '../../base/redux/PersistenceRegistry';
import ReducerRegistry from '../../base/redux/ReducerRegistry';

import { SET_VIRTUAL_BACKGROUND, SET_VIRTUAL_BACKGROUND_STORED_IMAGES } from './actionTypes';
import { VIRTUAL_BACKGROUND_TYPE } from './constants';

const STORE_NAME = 'features/mobile/virtual-background';

export interface IMobileVirtualBackgroundState {

    /**
     * Which kind of background is applied to the local camera.
     */
    backgroundType: string;

    /**
     * Blur strength, meaningful when {@code backgroundType} is {@code blur}.
     */
    blurValue?: number;

    /**
     * The URIs of the backgrounds imported from the device gallery, oldest first.
     */
    storedImages: string[];

    /**
     * The URI of the image being used, meaningful when {@code backgroundType} is {@code image}.
     */
    uri?: string;
}

const DEFAULT_STATE: IMobileVirtualBackgroundState = {
    backgroundType: VIRTUAL_BACKGROUND_TYPE.NONE,
    storedImages: []
};

/**
 * The selected background is remembered across conferences and app restarts, just like on web.
 *
 * The defaults are passed along so that a slice persisted by a build which did not have all of these fields yet is
 * filled in rather than rehydrated with holes: redux keeps the rehydrated value as it is, so a missing field would stay
 * undefined instead of falling back to the initial state below.
 */
PersistenceRegistry.register(STORE_NAME, true, DEFAULT_STATE);

ReducerRegistry.register<IMobileVirtualBackgroundState>(STORE_NAME,
    (state = DEFAULT_STATE, action): IMobileVirtualBackgroundState => {
        switch (action.type) {
        case SET_VIRTUAL_BACKGROUND:
            return {
                ...state,
                backgroundType: action.backgroundType,
                blurValue: action.blurValue,
                uri: action.uri
            };

        case SET_VIRTUAL_BACKGROUND_STORED_IMAGES:
            return {
                ...state,
                storedImages: action.storedImages
            };

        default:
            return state;
        }
    });
