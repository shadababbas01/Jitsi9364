import { IReduxState } from '../app/types';

import { LIVE_TRANSLATION_PANEL_HEIGHT_RATIO, LIVE_TRANSLATION_PANEL_MIN_HEIGHT } from './constants';
import { ILiveTranslationState } from './reducer';

const DEFAULT_STATE: ILiveTranslationState = {
    active: false,
    dictating: false,
    error: null,
    micOn: true,
    pending: 0,
    untranslated: {}
};

/**
 * Returns the live translation call state.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {ILiveTranslationState}
 */
export function getLiveTranslationState(state: IReduxState): ILiveTranslationState {
    return state['features/live-translation'] ?? DEFAULT_STATE;
}

/**
 * Returns whether the live translation call is running.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean}
 */
export function isLiveTranslationActive(state: IReduxState): boolean {
    return getLiveTranslationState(state).active;
}

/**
 * Returns the height the live translation panel takes away from the video, or 0 when it is not shown.
 *
 * The video layout has to agree with the panel on this number: the tile grid sizes itself from the viewport height, so
 * it needs the reduced height in order to reflow instead of being clipped.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {number}
 */
export function getLiveTranslationPanelHeight(state: IReduxState): number {
    if (!isLiveTranslationActive(state)) {
        return 0;
    }

    const { clientHeight = 0 } = state['features/base/responsive-ui'];

    return Math.min(
        clientHeight,
        Math.max(
            LIVE_TRANSLATION_PANEL_MIN_HEIGHT,
            Math.round(clientHeight * LIVE_TRANSLATION_PANEL_HEIGHT_RATIO)));
}

/**
 * Returns whether one participant is to be heard in their own voice rather than read out in translation.
 *
 * Two things follow from it, and they belong together: nothing that participant says is spoken by the engine, and their
 * own audio is left at full volume instead of being turned down to make room for a translation which is not coming.
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} participantId - The participant to ask about.
 * @returns {boolean}
 */
export function isParticipantUntranslated(state: IReduxState, participantId?: string): boolean {
    return Boolean(participantId && getLiveTranslationState(state).untranslated[participantId]);
}
