/* eslint-disable @typescript-eslint/no-use-before-define, react-native/no-color-literals, react/jsx-no-bind */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useDispatch, useSelector, useStore } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideDialog } from '../../../base/dialog/actions';
import { setTranscriptionStartedByCurrentUser } from '../../../chat/actions.any';
import { showNotification } from '../../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../../notifications/constants';
import { setInterviewConsent, setRequestingSubtitles, setSummaryCategory, setSummaryEnabled } from '../../actions.any';
import { isLiveCaptionsActive } from '../../functions.any';

const FALLBACK_CATEGORIES = [ 'meeting', 'interview', 'standup' ];

export default function SummarySetupDialog() {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();
    const subtitles = useSelector((state: IReduxState) => state['features/subtitles']);
    const config = useSelector((state: IReduxState) => state['features/base/config']);
    const [ enabled, setEnabled ] = useState(Boolean(subtitles._summaryEnabled));
    const [ category, setCategory ] = useState(subtitles._summaryCategory
        || config.summaryDefaultCategory || config.summaryCategories?.[0] || 'meeting');
    const [ consent, setConsent ] = useState(Boolean(subtitles._interviewConsent));
    const submitting = useRef(false);
    const categories = useMemo(() => config.summaryCategories?.length ? config.summaryCategories : FALLBACK_CATEGORIES, [ config.summaryCategories ]);
    const previous = Boolean(subtitles._summaryEnabled);
    const requiresConsent = category === 'interview' && Boolean(config.interviewTelemetry?.requireConsent);
    const submitLabel = previous && !enabled
        ? 'summarySetup.actions.stop'
        : previous ? 'summarySetup.actions.save' : 'summarySetup.actions.start';
    const changed = enabled !== previous || category !== (subtitles._summaryCategory || config.summaryDefaultCategory || 'meeting')
        || (requiresConsent && consent !== Boolean(subtitles._interviewConsent));

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            dispatch(hideDialog('SummarySetupDialog'));

            return true;
        });

        return () => sub.remove();
    }, [ dispatch ]);

    const close = () => dispatch(hideDialog('SummarySetupDialog'));
    const submit = () => {
        if (submitting.current || (!changed && enabled)) {
            return;
        }
        submitting.current = true;
        const wasEnabled = previous;

        if (!wasEnabled && enabled) {
            dispatch(setTranscriptionStartedByCurrentUser(true));
        }
        dispatch(setSummaryEnabled(enabled));
        dispatch(setSummaryCategory(category));

        const actualEnabled = Boolean((store.getState() as IReduxState)['features/subtitles']?._summaryEnabled);
        const blocked = enabled && !actualEnabled;

        if (enabled && !blocked && !isLiveCaptionsActive({ 'features/subtitles': subtitles } as IReduxState)) {
            dispatch(setTranscriptionStartedByCurrentUser(true));
            dispatch(setRequestingSubtitles(true, false, null));
        }
        if (category === 'interview' && requiresConsent) {
            dispatch(setInterviewConsent(consent));
        }
        const conference = (store.getState() as IReduxState)['features/base/conference'].conference;
        const payload = { type: 'cc-summary-control', enabled: actualEnabled, category };

        conference?.sendEndpointMessage?.('', payload);
        conference?.sendMessage?.(payload);
        dispatch(showNotification({ descriptionKey: actualEnabled
            ? 'summarySetup.notifications.enabled' : 'summarySetup.notifications.disabled' }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
        close();
    };

    return (<Modal
        animationType = 'fade'
        onRequestClose = { close }
        transparent = { true }
        visible = { true }>
        <View style = { styles.backdrop }>
            <View
                accessibilityViewIsModal = { true }
                style = { styles.card }
                testID = 'summary-setup-dialog'>
                <ScrollView>
                    <Text style = { styles.title }>{ t(enabled ? 'summarySetup.settingsTitle' : 'summarySetup.title', { defaultValue: 'AI Meeting Summary' }) }</Text>
                    <Text style = { styles.description }>{ t('summarySetup.description') }</Text>
                    <View style = { styles.row }>
                        <Text>{ t(enabled ? 'summarySetup.disableLabel' : 'summarySetup.enableLabel') }</Text>
                        <Switch
                            onValueChange = { setEnabled }
                            testID = 'summary-setup-enabled'
                            value = { enabled } />
                    </View>
                    <Text style = { styles.label }>{ t('summarySetup.templateLabel') }</Text>
                    { categories.map(value => (<Pressable
                        key = { value }
                        onPress = { () => setCategory(value) }
                        testID = 'summary-setup-category'>
                        <Text style = { [ styles.category, category === value && styles.selected ] }>{ t(`summarySetup.categories.${value}`, { defaultValue: value }) }</Text>
                    </Pressable>)) }
                    { requiresConsent && <View style = { styles.row }><Text>{ t('summarySetup.interviewConsent', { defaultValue: 'Allow interview telemetry' }) }</Text><Switch
                        onValueChange = { setConsent }
                        value = { consent } /></View> }
                </ScrollView>
                <View style = { styles.actions }>
                    <Pressable
                        onPress = { close }
                        testID = 'summary-setup-cancel'><Text>{ t('dialog.cancel', { defaultValue: 'Cancel' }) }</Text></Pressable>
                    <Pressable
                        disabled = { !changed || submitting.current }
                        onPress = { submit }
                        testID = 'summary-setup-submit'><Text>{ t(submitLabel, { defaultValue: previous && !enabled ? 'Stop summary' : enabled ? 'Save changes' : 'Start summary' }) }</Text></Pressable>
                </View>
            </View>
        </View>
    </Modal>);
}

const styles = StyleSheet.create({
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, paddingTop: 20 },
    backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,.65)', flex: 1, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '85%', padding: 24, width: '100%' },
    category: { paddingVertical: 12 },
    description: { marginBottom: 20 },
    label: { fontWeight: '600', marginTop: 16 },
    row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    selected: { fontWeight: '700' },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 12 }
});
