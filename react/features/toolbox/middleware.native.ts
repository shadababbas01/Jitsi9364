import { IStore } from '../app/types';
import { OVERWRITE_CONFIG, SET_CONFIG, UPDATE_CONFIG } from '../base/config/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { I_AM_VISITOR_MODE } from '../visitors/actionTypes';

import { SET_TOOLBAR_BUTTONS, SET_TOOLBOX_VISIBLE, TOGGLE_TOOLBOX_VISIBLE } from './actionTypes';
import { setMainToolbarThresholds, setToolboxVisible } from './actions.native';
import { NATIVE_THRESHOLDS, NATIVE_TOOLBAR_BUTTONS } from './constants';
import { getToolbarButtons } from './functions.native';

/**
 * How long the native toolbox and its side toolbar remain visible after being shown.
 */
const TOOLBOX_AUTO_HIDE_TIMEOUT_MS = 3000;

let autoHideTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * Replaces the pending auto-hide timer with one matching the current visibility.
 *
 * @param {Object} store - The Redux store.
 * @returns {void}
 */
function _syncAutoHide(store: IStore) {
    clearTimeout(autoHideTimeout);
    autoHideTimeout = undefined;

    if (!store.getState()['features/toolbox'].visible) {
        return;
    }

    autoHideTimeout = setTimeout(() => {
        autoHideTimeout = undefined;
        store.dispatch(setToolboxVisible(false));
    }, TOOLBOX_AUTO_HIDE_TIMEOUT_MS);
}


/**
 * Middleware which intercepts Toolbox actions to handle changes to the
 * visibility timeout of the Toolbox.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */

MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {

    case SET_TOOLBOX_VISIBLE:
    case TOGGLE_TOOLBOX_VISIBLE: {
        const result = next(action);

        _syncAutoHide(store);

        return result;
    }

    case UPDATE_CONFIG:
    case OVERWRITE_CONFIG:
    case I_AM_VISITOR_MODE:
    case SET_CONFIG: {
        const result = next(action);
        const { dispatch } = store;
        const state = store.getState();

        const toolbarButtons = getToolbarButtons(state, NATIVE_TOOLBAR_BUTTONS);

        if (action.type !== I_AM_VISITOR_MODE) {
            dispatch(setMainToolbarThresholds(NATIVE_THRESHOLDS));
        }

        dispatch({
            type: SET_TOOLBAR_BUTTONS,
            toolbarButtons
        });

        return result;
    }
    }

    return next(action);
});
