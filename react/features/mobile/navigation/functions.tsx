import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureResponderEvent, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';


import { appNavigate } from '../../app/actions.native';
import { IStateful } from '../../base/app/types';
import { PREJOIN_PAGE_ENABLED } from '../../base/flags/constants';
import { getFeatureFlag } from '../../base/flags/functions';
import { IconCloseLarge } from '../../base/icons/svg';
import { toState } from '../../base/redux/functions';
import { cancelKnocking } from '../../lobby/actions.native';
import { isPrejoinEnabledInConfig } from '../../prejoin/functions.native';

import HeaderNavigationButton from './components/HeaderNavigationButton';


/**
 * The room the header of a screen opened over the meeting leaves at its top. In portrait that is the top safe area,
 * so the title clears the status bar and the camera cutout. In landscape it is nothing, as it always was: the cutout
 * is at the side there, and pushing the header down would only take height from an already short screen.
 *
 * @returns {number}
 */
export function useHeaderStatusBarHeight() {
    const { top } = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();

    return height > width ? top : 0;
}

/**
 * Close icon/text button based on platform.
 *
 * @param {Function} goBack - Goes back to the previous screen function.
 * @returns {React.Component}
 */
export function screenHeaderCloseButton(goBack: (e?: GestureResponderEvent | React.MouseEvent) => void) {
    const { t } = useTranslation();

    if (Platform.OS === 'ios') {
        return (
            <HeaderNavigationButton
                id = { 'close-screen-button' }
                label = { t('dialog.close') }
                onPress = { goBack } />
        );
    }

    return (
        <HeaderNavigationButton
            id = { 'close-screen-button' }
            onPress = { goBack }
            src = { IconCloseLarge } />
    );
}

/**
 * Determines whether the {@code Prejoin page} is enabled by the app itself
 * (e.g. Programmatically via the Jitsi Meet SDK for Android and iOS).
 *
 * @param {Function|Object} stateful - The redux state or {@link getState}
 * function.
 * @returns {boolean} If the {@code Prejoin} is enabled by the app, then
 * {@code true}; otherwise, {@code false}.
 */
export function isPrejoinPageEnabled(stateful: IStateful) {
    const state = toState(stateful);

    return getFeatureFlag(state, PREJOIN_PAGE_ENABLED, isPrejoinEnabledInConfig(state));
}

/**
 * Close icon/text button for lobby screen based on platform.
 *
 * @returns {React.Component}
 */
export function lobbyScreenHeaderCloseButton() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const goBack = useCallback(() => {
        dispatch(cancelKnocking());
        dispatch(appNavigate(undefined));
    }, [ dispatch ]);

    if (Platform.OS === 'ios') {
        return (
            <HeaderNavigationButton
                id = { 'close-screen-button' }
                label = { t('dialog.close') }
                onPress = { goBack } />
        );
    }

    return (
        <HeaderNavigationButton
            id = { 'close-screen-button' }
            onPress = { goBack }
            src = { IconCloseLarge } />
    );
}
