import { NavigationContainer, Theme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useCallback, useEffect } from 'react';
import { connect } from 'react-redux';

import { IReduxState, IStore } from '../../../app/types';
import logger from '../../../app/logger';
import DialInSummary from '../../../invite/components/dial-in-summary/native/DialInSummary';
import Prejoin from '../../../prejoin/components/native/Prejoin';
import UnsafeRoomWarning from '../../../prejoin/components/native/UnsafeRoomWarning';
import { isUnsafeRoomWarningEnabled } from '../../../prejoin/functions.native';
import VisitorsQueue from '../../../visitors/components/native/VisitorsQueue';
// eslint-disable-next-line
// @ts-ignore
import WelcomePage from '../../../welcome/components/WelcomePage';
import { isWelcomePageEnabled } from '../../../welcome/functions';
import { _ROOT_NAVIGATION_READY } from '../actionTypes';
import { rootNavigationRef } from '../rootNavigationContainerRef';
import { screen } from '../routes';
import {
    conferenceNavigationContainerScreenOptions,
    connectingScreenOptions,
    dialInSummaryScreenOptions,
    navigationContainerTheme,
    preJoinScreenOptions,
    unsafeMeetingScreenOptions,
    visitorsScreenOptions,
    welcomeScreenOptions
} from '../screenOptions';

import ConnectingPage from './ConnectingPage';
import ConferenceNavigationContainer
    from './conference/components/ConferenceNavigationContainer';

const RootStack = createStackNavigator();


interface IProps {

    /**
     * Redux dispatch function.
     */
    dispatch: IStore['dispatch'];

    /**
    * Is unsafe room warning available?
    */
    isUnsafeRoomWarningAvailable: boolean;

    /**
    * Is welcome page available?
    */
    isWelcomePageAvailable: boolean;
}


const RootNavigationContainer = ({ dispatch, isUnsafeRoomWarningAvailable, isWelcomePageAvailable }: IProps) => {
    // TODO(shadab): confirm integration type (react-native-jitsi-meet / native JitsiMeetActivity / WebView),
    // call trigger (UI button vs background), and navigation stack details to fine-tune launch flow.
    const initialRouteName = isWelcomePageAvailable ? screen.welcome.main : screen.connecting;
    const onReady = useCallback(() => {
        dispatch({
            type: _ROOT_NAVIGATION_READY,
            ready: true
        });
    }, [ dispatch ]);

    useEffect(() => {
        logger.info(`[JitsiUI] RootNavigation init: welcome=${isWelcomePageAvailable} initialRoute=${initialRouteName}`);
    }, [ isWelcomePageAvailable, initialRouteName ]);

    return (
        <NavigationContainer
            independent = { true }
            onReady = { onReady }
            ref = { rootNavigationRef }
            theme = { navigationContainerTheme as Theme }>
            <RootStack.Navigator
                initialRouteName = { initialRouteName }>
                {
                    isWelcomePageAvailable
                        && <>
                            <RootStack.Screen // @ts-ignore
                                component = { WelcomePage }
                                name = { screen.welcome.main }
                                options = { welcomeScreenOptions } />
                            <RootStack.Screen

                                // @ts-ignore
                                component = { DialInSummary }
                                name = { screen.dialInSummary }
                                options = { dialInSummaryScreenOptions } />
                        </>
                }
                <RootStack.Screen
                    component = { ConnectingPage }
                    name = { screen.connecting }
                options = { connectingScreenOptions } />
                {/* <RootStack.Screen
                    component = { Prejoin }
                    name = { screen.preJoin }
                     options = { preJoinScreenOptions } /> */}
                {
                    isUnsafeRoomWarningAvailable
                    && <RootStack.Screen
                        component = { UnsafeRoomWarning }
                        name = { screen.unsafeRoomWarning }
                        options = { unsafeMeetingScreenOptions } />
                }
                <RootStack.Screen
                    component = { VisitorsQueue }
                    name = { screen.visitorsQueue }
                    options = { visitorsScreenOptions } />
                <RootStack.Screen
                    component = { ConferenceNavigationContainer }
                    name = { screen.conference.root }
                    options = { conferenceNavigationContainerScreenOptions } />
            </RootStack.Navigator>
        </NavigationContainer>
    );
};

/**
 * Maps part of the Redux store to the props of this component.
 *
 * @param {Object} state - The Redux state.
 * @returns {IProps}
 */
function mapStateToProps(state: IReduxState) {
    return {
        isUnsafeRoomWarningAvailable: isUnsafeRoomWarningEnabled(state),
        isWelcomePageAvailable: isWelcomePageEnabled(state)
    };
}

export default connect(mapStateToProps)(RootNavigationContainer);
