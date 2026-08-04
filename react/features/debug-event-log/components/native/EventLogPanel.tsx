import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { clearEventLog } from '../../actions';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';

import styles from './styles';

const MAX_VISIBLE = 50;

const EventLogPanel = () => {
    const dispatch = useDispatch();
    const [ collapsed, setCollapsed ] = useState(false);
    const entries = useSelector((state: IReduxState) => state['features/debug-event-log']?.entries ?? []);

    const visibleEntries = useMemo(() => entries.slice(-MAX_VISIBLE).reverse(), [ entries ]);

    if (!entries.length && collapsed) {
        return null;
    }

    return (
        <View style = { styles.container as ViewStyle }>
            <View style = { styles.header as ViewStyle }>
                <Text style = { styles.titleText }>{`Event Log (${entries.length})`}</Text>
                <View style = { styles.headerActions as ViewStyle }>
                    <TouchableOpacity
                        onPress = { () => setCollapsed(!collapsed) }
                        style = { styles.headerButton as ViewStyle }>
                        <Text style = { styles.headerButtonText }>
                            { collapsed ? 'Show' : 'Hide' }
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress = { () => dispatch(clearEventLog()) }
                        style = { styles.headerButton as ViewStyle }>
                        <Text style = { styles.headerButtonText }>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {
                !collapsed && (
                    <ScrollView style = { styles.list as ViewStyle }>
                        {
                            visibleEntries.map(entry => (
                                <View key = { entry.id } style = { styles.item as ViewStyle }>
                                    <Text style = { styles.itemHeader }>
                                        { new Date(entry.timestamp).toLocaleTimeString() } · { entry.name }
                                    </Text>
                                    {
                                        entry.source && (
                                            <Text style = { styles.itemMeta }>
                                                { `source: ${entry.source}` }
                                            </Text>
                                        )
                                    }
                                    {
                                        entry.payload && (
                                            <Text
                                                style = { styles.itemPayload }
                                                numberOfLines = { 5 }>
                                                { stringifyPayload(entry.payload) }
                                            </Text>
                                        )
                                    }
                                </View>
                            ))
                        }
                        {
                            entries.length > MAX_VISIBLE && (
                                <Text style = { styles.footerText }>
                                    { `Showing last ${MAX_VISIBLE} events` }
                                </Text>
                            )
                        }
                    </ScrollView>
                )
            }
        </View>
    );
};

function stringifyPayload(payload: any) {
    try {
        return JSON.stringify(payload, null, 2);
    } catch (e) {
        return String(payload);
    }
}

export default EventLogPanel;
