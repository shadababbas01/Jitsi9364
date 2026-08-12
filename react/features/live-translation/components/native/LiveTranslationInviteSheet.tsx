import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useDispatch } from 'react-redux';

import { hideSheet } from '../../../base/dialog/actions';
import BottomSheet from '../../../base/dialog/components/native/BottomSheet';
import Icon from '../../../base/icons/components/Icon';
import { IconTranslate } from '../../../base/icons/svg';

import styles, { LIVE_TRANSLATION_COLORS } from './styles';

interface IProps {

    /**
     * The name of whoever is asking, which is the whole of what makes the question answerable.
     */
    inviterName: string;

    /**
     * Called when the invitation is turned down, including when the sheet is dismissed without answering: somebody who
     * swipes the question away has not agreed to anything.
     */
    onDecline: () => void;

    /**
     * Called when the invitation is taken up.
     */
    onAllow: () => void;
}

/**
 * The invitation to join a translated call somebody else started.
 *
 * A sheet at the bottom of the screen rather than a dialog in the middle of it, because it arrives unannounced during a
 * call and is answered with the thumb of whichever hand is already holding the phone.
 *
 * @param {IProps} props - Component props.
 * @returns {JSX.Element}
 */
export default function LiveTranslationInviteSheet({ inviterName, onAllow, onDecline }: IProps) {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const decline = useCallback(() => {
        dispatch(hideSheet());
        onDecline();
    }, [ dispatch, onDecline ]);

    const allow = useCallback(() => {
        dispatch(hideSheet());
        onAllow();
    }, [ dispatch, onAllow ]);

    return (
        <BottomSheet
            addScrollViewPadding = { false }
            onCancel = { decline }
            style = { styles.inviteSheet }>
            <View style = { styles.grabber as ViewStyle } />
            <View style = { styles.inviteBody as ViewStyle }>
                <View style = { styles.inviteHeader as ViewStyle }>
                    <View style = { styles.inviteIcon as ViewStyle }>
                        <Icon
                            color = { LIVE_TRANSLATION_COLORS.text }
                            size = { 24 }
                            src = { IconTranslate } />
                    </View>
                    <Text style = { styles.inviteTitle as TextStyle }>
                        { t('liveTranslation.inviteTitle') }
                    </Text>
                </View>
                <Text style = { styles.inviteDescription as TextStyle }>
                    { t('liveTranslation.inviteDescription', { name: inviterName }) }
                </Text>
                <View style = { styles.inviteActions as ViewStyle }>
                    <Pressable
                        accessibilityLabel = { t('dialog.Cancel') }
                        accessibilityRole = 'button'
                        onPress = { decline }
                        style = { [ styles.inviteButton, styles.inviteButtonDecline ] as ViewStyle[] }>
                        <Text
                            style = { [
                                styles.inviteButtonLabel,
                                styles.inviteButtonLabelDecline
                            ] as TextStyle[] }>
                            { t('dialog.Cancel') }
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityLabel = { t('liveTranslation.inviteAllow') }
                        accessibilityRole = 'button'
                        onPress = { allow }
                        style = { [ styles.inviteButton, styles.inviteButtonAccept ] as ViewStyle[] }>
                        <Text
                            style = { [
                                styles.inviteButtonLabel,
                                styles.inviteButtonLabelAccept
                            ] as TextStyle[] }>
                            { t('liveTranslation.inviteAllow') }
                        </Text>
                    </Pressable>
                </View>
            </View>
        </BottomSheet>
    );
}
