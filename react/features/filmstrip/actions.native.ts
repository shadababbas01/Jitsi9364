import { IStore } from '../app/types';
import { getParticipantCount, getParticipantCountWithFake } from '../base/participants/functions';
import conferenceStyles from '../conference/components/native/styles';

import { SET_TILE_VIEW_DIMENSIONS } from './actionTypes';
import styles from './components/native/styles';
import { SQUARE_TILE_ASPECT_RATIO, TILE_MARGIN } from './constants';
// import { getColumnCount, getTileViewParticipantCount } from './functions.native';
import { getTileViewParticipantCount } from './functions.native';

export * from './actions.any';
var TILE_ASPECT_RATIO = 1;
var MAX_COLUMN_LANDSCAPE = 3;
var MAX_COLUMN_PORTRAIT = 3;
var max_fit_rows = 3;
var expected_row = 1;
var expected_col;
/**
 * Sets the dimensions of the tile view grid. The action is only partially implemented on native as not all
 * of the values are currently used. Check the description of {@link SET_TILE_VIEW_DIMENSIONS} for the full set
 * of properties.
 *
 * @returns {Function}
 */
export function setTileViewDimensions() {
    return (dispatch: Function, getState: Function) => {
        const state = getState();
        const participantCount = getParticipantCount(state);
        const { clientHeight: height, clientWidth: width } = state['features/base/responsive-ui'];
        const columns = getColumnCount(state);
        const heightToUse = height - (TILE_MARGIN * 2);
        const widthToUse = width - (TILE_MARGIN * 2);
        var rows = Math.ceil(participantCount / columns);
        let tileWidth;
        TILE_ASPECT_RATIO = widthToUse / heightToUse

        // If there is going to be at least two rows, ensure that at least two
        // rows display fully on screen.
        

        if(width>height){
            if(participantCount>3){
            if (participantCount / columns > 1) {
                tileWidth = Math.max(widthToUse / columns, heightToUse / 2);
            } else {
                tileWidth = Math.max(widthToUse / columns, heightToUse);
            }
        }else{
            if (participantCount / columns > 1) {
                tileWidth = Math.min(widthToUse / columns, heightToUse / 2);
            } else {
                tileWidth = Math.min(widthToUse / columns, heightToUse);
            }
        }
            tileWidth = Math.floor(tileWidth);
          //  console.log("melpApp--->","height--->"+(Math.min(heightToUse / Math.min(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO))+"--width--"+tileWidth+"--expectedRow-->"+expected_row+"---expectedColum-->"+expected_col+"---participant--->"+participantCount+"--htous--"+heightToUse+"---Wtouse--->"+widthToUse+"_--Ratio--"+TILE_ASPECT_RATIO);
                dispatch({
                    type: SET_TILE_VIEW_DIMENSIONS,
                    dimensions: {
                        columns,
                        thumbnailSize: {
                         //   height: heightToUse/expected_row,
                          //  width: widthToUse/columns,
                          height:(Math.min(heightToUse / Math.min(expected_row,max_fit_rows))),//(Math.min(heightToUse / Math.min(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),// tileWidth, //(Math.min(heightToUse / Math.max(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),
                          width: tileWidth,
                          aspectRatio: TILE_ASPECT_RATIO
                        },  
                        gridDimensions: {
                            columns: columns,
                          //  height: heightToUse/expected_row,
                           // width: widthToUse/columns,
                           height:(Math.min(heightToUse / Math.min(expected_row,max_fit_rows))),//(Math.min(height / Math.min(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),// tileWidth, //(Math.min(heightToUse / Math.max(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),
                            width: tileWidth,
                        }
                    }
                });

        }else{
            if (participantCount / columns > 1) {
                tileWidth = Math.min(widthToUse / columns, heightToUse / 2);
            } else {
                tileWidth = Math.min(widthToUse / columns, heightToUse);
            }
            tileWidth = Math.floor(tileWidth);
                dispatch({
                    type: SET_TILE_VIEW_DIMENSIONS,
                    dimensions: {
                        columns,
                        thumbnailSize: {
                            height:(Math.min(heightToUse / Math.min(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),// tileWidth, //(Math.min(heightToUse / Math.max(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),
            	            width: tileWidth,
                            aspectRatio: TILE_ASPECT_RATIO
                        },
                        gridDimensions: {
                            columns: columns,
                            height: (Math.min(heightToUse / Math.min(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),
                          //  height: (Math.min(heightToUse / Math.max(expected_row,max_fit_rows), tileWidth / TILE_ASPECT_RATIO)),
                            width: tileWidth
                        }
                    }
                });


        }
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

function getColumnCount(state: Object | Function) {

    const participantCount = getParticipantCountWithFake(state);
    const { clientHeight: height, clientWidth: width } = state['features/base/responsive-ui'];
    if(width > height){

           if(participantCount <MAX_COLUMN_LANDSCAPE * max_fit_rows)
           {
            expected_row = Math.floor(Math.sqrt(participantCount))
            expected_col = Math.ceil(participantCount / expected_row)
           }
            else{

         expected_col = participantCount/max_fit_rows
         expected_col = Math.min(expected_col, MAX_COLUMN_LANDSCAPE)
        }
           return   expected_col;

    }else{
          expected_row = Math.ceil(Math.sqrt(participantCount));
          expected_col = Math.min(MAX_COLUMN_PORTRAIT,Math.ceil(participantCount/Math.min(max_fit_rows,expected_row)));
           expected_row = Math.ceil(participantCount/expected_col)            
      return  expected_col;

    }
}