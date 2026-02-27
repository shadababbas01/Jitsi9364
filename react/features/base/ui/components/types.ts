import { BUTTON_TYPES } from '../constants.any';

export interface IButtonProps {

    /**
     * Label used for accessibility.
     */
    accessibilityLabel?: string;

    /**
     * Whether or not the button should automatically focus.
     */
    autoFocus?: boolean;

    /**
     * Whether or not the button is disabled.
     */
    disabled?: boolean;

    /**
     * The icon to be displayed on the button.
     */
    icon?: Function;

    /**
     * The translation key of the text to be displayed on the button.
     */
    labelKey?: string;

    /**
     * Click callback.
     */
    onClick?: (e?: any) => void;

    /**
     * Press in callback (native).
     */
    onPressIn?: (e?: GestureResponderEvent) => void;

    /**
     * Press out callback (native).
     */
    onPressOut?: (e?: GestureResponderEvent) => void;

    /**
     * Key press callback.
     */
    onKeyPress?: (e?: React.KeyboardEvent<HTMLButtonElement>) => void;

    /**
     * The type of button to be displayed.
     */
    type?: BUTTON_TYPES;
}

export interface IInputProps {

    /**
     * Whether the input is be clearable. (show clear button).
     */
    clearable?: boolean;

    /**
     * Whether the input is be disabled.
     */
    disabled?: boolean;

    /**
     * Whether the input is in error state.
     */
    error?: boolean;

    /**
     * The icon to be displayed on the input.
     */
    icon?: Function;

    /**
     * The label of the input.
     */
    label?: string;

    /**
     * Change callback.
     */
    onChange?: (value: string) => void;

    /**
     * The input placeholder text.
     */
    placeholder?: string;

    /**
     * The value of the input.
     */
    value: string | number;


    /**
     * Optional border color when the input is focused.
     */
    focusBorderColor?: string;
}

export interface ISwitchProps {

    /**
     * Whether or not the toggle is on.
     */
    checked: boolean;

    /**
     * Whether or not the toggle is disabled.
     */
    disabled?: boolean;

    /**
     * Toggle change callback.
     */
    onChange: (on?: boolean) => void;
}

export type MultiSelectItem = {
    content: string;
    description?: string;
    elemBefore?: Element;
    isDisabled?: boolean;
    value: string;
};
