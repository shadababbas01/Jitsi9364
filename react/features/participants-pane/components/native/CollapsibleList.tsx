import React, { useCallback, useState } from 'react';
import { GestureResponderEvent, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

import Icon from '../../../base/icons/components/Icon';
import { IconArrowDown, IconArrowUp } from '../../../base/icons/svg';
import styles from '../../../breakout-rooms/components/native/styles';

interface IProps {

    /**
     * The children to be displayed within this list.
     */
    children: React.ReactNode;

    /**
     * Callback to invoke when the {@code CollapsibleList} is long pressed.
     */
    onLongPress?: (e?: GestureResponderEvent) => void;

    /**
     * Collapsible list title.
     */
    title: Object;

    /**
     * Optional component rendered on the right side of the header row.
     */
    rightAction?: React.ReactNode;
}

const CollapsibleList = ({ children, onLongPress, rightAction, title }: IProps) => {
    const [ collapsed, setCollapsed ] = useState(false);
    const _toggleCollapsed = useCallback(() => {
        setCollapsed(!collapsed);
    }, [ collapsed ]);

    return (
        <View>
            <TouchableOpacity
                onLongPress = { onLongPress }
                onPress = { _toggleCollapsed }
                style = { styles.collapsibleList as ViewStyle }>
                <TouchableOpacity
                onPress = { _toggleCollapsed }
                style = { styles.arrowIcon as ViewStyle }>
                <Icon
                    size = { 18 }
                    src = { collapsed ? IconArrowDown : IconArrowUp } />
            </TouchableOpacity>
            <Text
                numberOfLines = { 1 }
                style = { styles.listTile as TextStyle }>
                { title }
            </Text>
            { rightAction ? (
                <View style = { styles.headerAction as ViewStyle }>
                    { rightAction }
                </View>
            ) : null }
            </TouchableOpacity>
            { !collapsed && children }
        </View>
    );
};

export default CollapsibleList;
