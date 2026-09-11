import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

import styles from './styles';

interface IProps {

    /**
     * The already-translated caption to show under the button.
     */
    caption: string;

    /**
     * The button to render.
     */
    children: React.ReactNode;
}

/**
 * A column consisting of a button (or button-like element) and its caption, laid out the way the
 * rest of the audio call toolbox's columns are.
 *
 * @param {IProps} props - The component's props.
 * @returns {JSX.Element}
 */
const ToolboxColumn = ({ caption, children }: IProps): JSX.Element => (
    <View style = { styles.toolboxColumn as ViewStyle }>
        { children }
        <Text style = { styles.toolboxCaption }>
            { caption }
        </Text>
    </View>
);

export default ToolboxColumn;
