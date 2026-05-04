import { IStore } from '../app/types';
import conferenceStyles from '../conference/components/native/styles';

import { SET_TILE_VIEW_DIMENSIONS } from './actionTypes';
import { TILE_HORIZONTAL_MARGIN, TILE_MARGIN, TILE_VERTICAL_MARGIN } from './constants';
import {
    getColumnCount,
    getMaxVisibleRows,
    getTileViewParticipantCount
} from './functions.native';

export * from './actions.any';

/**
 * Sets the dimensions of the tile view grid. The action is only partially implemented on native as not all
 * of the values are currently used. Check the description of {@link SET_TILE_VIEW_DIMENSIONS} for the full set
 * of properties.
 *
 * @returns {Function}
 */
export function setTileViewDimensions() {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        const state = getState();
        const participantCount = getTileViewParticipantCount(state);
        const { clientHeight: height, clientWidth: width, safeAreaInsets = {
            left: undefined,
            right: undefined,
            top: undefined,
            bottom: undefined
        } } = state['features/base/responsive-ui'];
        const { left = 0, right = 0, top = 0, bottom = 0 } = safeAreaInsets;
        const columns = getColumnCount(state);
        const rows = Math.ceil(participantCount / columns); // @ts-ignore
        const visibleRows = Math.min(rows, getMaxVisibleRows(state));
        const conferenceBorder = conferenceStyles.conference.borderWidth || 0;
        const heightToUse = height - top - bottom - (2 * conferenceBorder);
        const widthToUse = width - (TILE_MARGIN * 2) - left - right - (2 * conferenceBorder);
        const tileWidth = Math.max(1, Math.floor(widthToUse / columns) - (TILE_HORIZONTAL_MARGIN * 2));
        const tileHeight = Math.max(1, Math.floor(heightToUse / visibleRows) - (TILE_VERTICAL_MARGIN * 2));
        const hasScroll = rows > visibleRows;

        dispatch({
            type: SET_TILE_VIEW_DIMENSIONS,
            dimensions: {
                columns,
                gridDimensions: {
                    columns,
                    rows: visibleRows
                },
                thumbnailSize: {
                    height: tileHeight,
                    width: tileWidth
                },
                hasScroll
            }
        });
    };
}

/**
 * Add participant to the active participants list.
 *
 * @param {string} _participantId - The Id of the participant to be added.
 * @param {boolean?} _pinned - Whether the participant is pinned or not.
 * @returns {Object}
 */
export function addStageParticipant(_participantId: string, _pinned = false): any {
    return {};
}

/**
 * Remove participant from the active participants list.
 *
 * @param {string} _participantId - The Id of the participant to be removed.
 * @returns {Object}
 */
export function removeStageParticipant(_participantId: string): any {
    return {};
}
