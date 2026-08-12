import { MEDIA_TYPE, VIDEO_TYPE } from '../../base/media/constants';
import MiddlewareRegistry from '../../base/redux/MiddlewareRegistry';
import { TRACK_ADDED } from '../../base/tracks/actionTypes';

import { applyVirtualBackground } from './actions';
import { isVirtualBackgroundEnabled, isVirtualBackgroundSupported } from './functions';

/**
 * Re-attaches the virtual background whenever a new local camera track appears.
 *
 * The effect lives on the capturer's video source, so it goes away with the track it was installed
 * on. On mobile the camera track is disposed when the camera is turned off (to release the device)
 * and a brand new one is created when it is turned back on, so without this the background would
 * silently stop applying after the first camera toggle. The same path restores a remembered
 * background when the app starts.
 */
MiddlewareRegistry.register(store => next => action => {
    const result = next(action);

    if (action.type === TRACK_ADDED) {
        const { track } = action;

        if (track?.local
                && track.mediaType === MEDIA_TYPE.VIDEO
                && track.videoType !== VIDEO_TYPE.DESKTOP) {
            const state = store.getState();

            if (isVirtualBackgroundSupported(state) && isVirtualBackgroundEnabled(state)) {
                store.dispatch(applyVirtualBackground(false));
            }
        }
    }

    return result;
});
