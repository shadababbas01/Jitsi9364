/* eslint-disable react-native/no-color-literals */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import { StyleType } from '../../../base/styles/functions.any';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import { ChatTabs } from '../../../chat/constants';
import { TabBarLabelCounter }
    from '../../../mobile/navigation/components/TabBarLabelCounter';
import AbstractPollsPane from '../AbstractPollsPane';
import type { AbstractProps } from '../AbstractPollsPane';

import PollCreate from './PollCreate';
import PollsList from './PollsList';
import { POLLS_ACCENT_COLOR, POLLS_CREATE_BUTTON_COLOR, chatStyles } from './styles';


const PollsPane = (props: AbstractProps) => {
    const { createMode, onCreate, setCreateMode, t } = props;
    const navigation = useNavigation();
    const isPollsTabFocused = useSelector(
        (state: IReduxState) => state['features/chat'].focusedTab === ChatTabs.POLLS);
    const { nbUnreadPolls } = useSelector((state: IReduxState) => state['features/polls']);

    useEffect(() => {
        const activeUnreadPollsNr = !isPollsTabFocused && nbUnreadPolls > 0;

        navigation.setOptions({
            // eslint-disable-next-line react/no-multi-comp
            tabBarLabel: () => (
                <TabBarLabelCounter
                    activeUnreadNr = { activeUnreadPollsNr }
                    isFocused = { isPollsTabFocused }
                    label = { t('chat.tabs.polls') }
                    unreadCount = { nbUnreadPolls } />
            )
        });

    }, [ isPollsTabFocused, nbUnreadPolls ]);

    const createPollButtonStyles = Platform.OS === 'android'
        ? chatStyles.createPollButtonAndroid : chatStyles.createPollButtonIos;

    return (
        <JitsiScreen
            contentContainerStyle = { chatStyles.pollPane as StyleType }
            disableForcedKeyboardDismiss = { true }
            hasExtraHeaderHeight = { true }
            style = { chatStyles.pollPaneContainer as StyleType }>
            {
                createMode
                    ? <PollCreate setCreateMode = { setCreateMode } />
                    : <PollsList />
            }
            {
                !createMode && <Button
                    accessibilityLabel = 'polls.create.create'
                    labelKey = 'polls.create.create'
                    onClick = { onCreate }
                    color = { POLLS_CREATE_BUTTON_COLOR }
                    style = { createPollButtonStyles }
                    type = { BUTTON_TYPES.DESTRUCTIVE } />
            }
        </JitsiScreen>
    );
};


/*
 * We apply AbstractPollsPane to fill in the AbstractProps common
 * to both the web and native implementations.
 */
// eslint-disable-next-line new-cap
export default AbstractPollsPane(PollsPane);
