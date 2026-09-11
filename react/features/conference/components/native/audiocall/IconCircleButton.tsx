import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';

import Icon from '../../../../base/icons/components/Icon';
import { StyleType } from '../../../../base/styles/functions.any';

import styles from './styles';

interface IProps {

    /**
     * The button's accessibility label.
     */
    accessibilityLabel: string;

    /**
     * Style of the circle itself; defaults to the toolbox grid's icon circle.
     */
    circleStyle?: StyleType;

    /**
     * Whether the button is disabled.
     */
    disabled?: boolean;

    /**
     * The icon to render.
     */
    icon: Function;

    /**
     * Style of the icon; defaults to the toolbox grid's icon style.
     */
    iconStyle?: StyleType;

    /**
     * Invoked when the button is pressed.
     */
    onPress?: () => void;
}

/**
 * A plain round icon button, used for the audio call screen's actions that don't have a
 * dedicated toolbox button component of their own (attendees, add call, more, PiP).
 *
 * @param {IProps} props - The component's props.
 * @returns {JSX.Element}
 */
const IconCircleButton = ({ accessibilityLabel, circleStyle, disabled, icon, iconStyle, onPress }: IProps):
JSX.Element => (
    <TouchableOpacity
        accessibilityLabel = { accessibilityLabel }
        disabled = { disabled }
        onPress = { onPress }
        style = { (circleStyle ?? (disabled ? styles.iconCircleDisabled : styles.iconCircle)) as ViewStyle }>
        <Icon
            src = { icon }
            style = { (iconStyle ?? (disabled ? styles.iconDisabled : styles.icon)) as StyleType } />
    </TouchableOpacity>
);

export default IconCircleButton;
