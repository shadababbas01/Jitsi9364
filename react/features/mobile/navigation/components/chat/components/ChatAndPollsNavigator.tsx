/* eslint-disable lines-around-comment */

import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../../../app/types';
import {
    getClientHeight,
    getClientWidth
} from '../../../../../base/modal/components/functions.native';
import { setFocusedTab } from '../../../../../chat/actions.any';
import { ChatTabs } from '../../../../../chat/constants';
import { isChatDisabled } from '../../../../../chat/functions';
// @ts-ignore
import Chat from '../../../../../chat/components/native/Chat';
import { resetNbUnreadPollsMessages } from '../../../../../polls/actions';
import PollsPane from '../../../../../polls/components/native/PollsPane';
import { screen } from '../../../routes';
import { chatTabBarOptions } from '../../../screenOptions';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const ChatTab = createMaterialTopTabNavigator();

const ChatAndPolls = () => {
    const clientHeight = useSelector(getClientHeight);
    const clientWidth = useSelector(getClientWidth);
    const dispatch = useDispatch();

    const navigation = useNavigation();
    const { t } = useTranslation();
    const focusedTab = useSelector((state: IReduxState) => state['features/chat'].focusedTab);
    const isChatTabVisible = !useSelector(isChatDisabled);
    const isPollsTabFocused = focusedTab === ChatTabs.POLLS;
    const initialRouteName = (!isChatTabVisible || isPollsTabFocused)
        ? screen.conference.chatTabs.tab.polls
        : screen.conference.chatTabs.tab.chat;


    useEffect(() => {
        navigation.setOptions({
            title: t(isChatTabVisible ? 'chat.titleWithPolls' : 'chat.tabs.polls')
        });
    }, [isChatTabVisible, navigation, t]);

    if (!isChatTabVisible) {
        return <PollsPane />;
    }

    return (
        // @ts-ignore
        <ChatTab.Navigator
        key = { isChatTabVisible ? 'chat-and-polls' : 'polls-only' }
            backBehavior='none'
            initialLayout={{
                height: clientHeight,
                width: clientWidth
            }}
            initialRouteName = { initialRouteName }
            screenOptions = { chatTabBarOptions }>
            { isChatTabVisible && (
                <ChatTab.Screen
                    component = { Chat }
                    listeners = {{
                        tabPress: () => {
                            dispatch(setFocusedTab(ChatTabs.CHAT));
                        }
                    }}
                    name = { screen.conference.chatTabs.tab.chat } />
            ) }
            <ChatTab.Screen
                component = { PollsPane }
                listeners = {{
                    tabPress: () => {
                        dispatch(setFocusedTab(ChatTabs.POLLS));
                        dispatch(resetNbUnreadPollsMessages());
                    }
                }}
                name = { screen.conference.chatTabs.tab.polls } />
        </ChatTab.Navigator>
    );
};

export default ChatAndPolls;
