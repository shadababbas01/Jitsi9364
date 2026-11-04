import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BackHandler,
    Image,
    ImageStyle,
    Pressable,
    ScrollView,
    Text,
    TextStyle,
    View,
    ViewStyle,
    useWindowDimensions
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import { dismissMeetingLimitDialog, upgradePlan } from '../actions.native';

import styles from './styles.native';

const CAPPING_IMAGE = require('../../../../images/callLimitImage.png');

/**
 * Below this window height (a phone in landscape) the illustration is dropped so the text and buttons fit without
 * scrolling.
 */
const MIN_HEIGHT_FOR_IMAGE = 520;

/**
 * The native plan-capping popup: quota warnings and blocks from the meeting-warning gates, and the server's
 * meeting-duration signals. It renders features/chat.meetingLimitDialog as given and is mounted once, in the app
 * shell, so it is on top of whichever screen the meeting is on, and also just after the meeting has ended.
 *
 * While the meeting runs, Upgrade (on top) asks the Melp host to open its signed-in plans page and Remind me later
 * (below it) only closes the popup. Once the meeting has ended there is only OK, which leaves the meeting.
 *
 * @returns {ReactElement|null}
 */
export default function MeetingLimitDialogContainer() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { ended, message, open, title } = useSelector(
        (state: IReduxState) => state['features/chat'].meetingLimitDialog);
    const { height } = useWindowDimensions();

    // A second tap before the popup is gone must not leave the meeting twice or open two plans pages.
    const handled = useRef(false);

    useEffect(() => {
        if (open) {
            handled.current = false;
        }
    }, [ open, title, message ]);

    const once = useCallback((run: () => void) => {
        if (!handled.current) {
            handled.current = true;
            run();
        }
    }, []);

    const onDismiss = useCallback(() => once(() => dispatch(dismissMeetingLimitDialog())), [ dispatch, once ]);
    const onUpgrade = useCallback(() => once(() => dispatch(upgradePlan())), [ dispatch, once ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        // Android back acts like Remind me later (or OK once the meeting has ended).
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            onDismiss();

            return true;
        });

        return () => subscription.remove();
    }, [ onDismiss, open ]);

    if (!open) {
        return null;
    }

    const pressedStyle = (base: ViewStyle) => ({ pressed }: { pressed: boolean; }) => [
        base,
        pressed ? styles.pressed : null
    ] as ViewStyle[];

    return (
        <View
            pointerEvents = 'auto'
            style = { styles.backdrop as ViewStyle }>
            <View
                accessibilityViewIsModal = { true }
                style = { styles.card as ViewStyle }
                testID = 'meeting-limit-dialog'>
                <ScrollView
                    bounces = { false }
                    contentContainerStyle = { styles.content as ViewStyle }
                    style = { styles.scroll as ViewStyle }>
                    { height >= MIN_HEIGHT_FOR_IMAGE && (
                        <Image
                            accessibilityIgnoresInvertColors = { true }
                            resizeMode = 'contain'
                            source = { CAPPING_IMAGE }
                            style = { styles.image as ImageStyle } />
                    ) }
                    <Text
                        accessibilityRole = 'header'
                        style = { styles.title as TextStyle }
                        testID = 'meeting-limit-dialog-title'>
                        { title || t('meetingLimit.defaultTitle', { defaultValue: 'Meeting ending soon' }) }
                    </Text>
                    { Boolean(message) && (
                        <Text
                            style = { styles.message as TextStyle }
                            testID = 'meeting-limit-dialog-message'>
                            { message }
                        </Text>
                    ) }
                </ScrollView>
                <View style = { styles.actions as ViewStyle }>
                    { ended
                        ? (
                            <Pressable
                                accessibilityRole = 'button'
                                onPress = { onDismiss }
                                style = { pressedStyle(styles.primaryButton as ViewStyle) }
                                testID = 'meeting-limit-dialog-ok'>
                                <Text
                                    allowFontScaling = { true }
                                    style = { styles.primaryButtonText as TextStyle }>
                                    { t('dialog.Ok') }
                                </Text>
                            </Pressable>
                        )
                        : (
                            <>
                                <Pressable
                                    accessibilityRole = 'button'
                                    onPress = { onUpgrade }
                                    style = { pressedStyle(styles.primaryButton as ViewStyle) }
                                    testID = 'meeting-limit-dialog-upgrade'>
                                    <Text
                                        allowFontScaling = { true }
                                        style = { styles.primaryButtonText as TextStyle }>
                                        { t('meetingLimit.upgrade', { defaultValue: 'Upgrade' }) }
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole = 'button'
                                    onPress = { onDismiss }
                                    style = { pressedStyle(styles.secondaryButton as ViewStyle) }
                                    testID = 'meeting-limit-dialog-remind-later'>
                                    <Text
                                        allowFontScaling = { true }
                                        style = { styles.secondaryButtonText as TextStyle }>
                                        { t('meetingLimit.remindLater', { defaultValue: 'Remind me later' }) }
                                    </Text>
                                </Pressable>
                            </>
                        ) }
                </View>
            </View>
        </View>
    );
}
