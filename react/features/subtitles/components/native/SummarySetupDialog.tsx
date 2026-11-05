/* eslint-disable @typescript-eslint/no-use-before-define, react-native/no-color-literals, react/jsx-no-bind */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useDispatch, useSelector, useStore } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideDialog } from '../../../base/dialog/actions';
import Icon from '../../../base/icons/components/Icon';
import { IconArrowDown, IconArrowUp, IconCloseLarge, IconShareDoc } from '../../../base/icons/svg';
import { isLocalParticipantModerator } from '../../../base/participants/functions';
import { setTranscriptionStartedByCurrentUser } from '../../../chat/actions.any';
import { showNotification } from '../../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../../notifications/constants';
import {
    setInterviewConsent,
    setRequestingSubtitles,
    setSummaryCategory,
    setSummaryEnabled
} from '../../actions.any';
import { isLiveTranscriptionActive } from '../../functions.any';
import { buildInterviewConsent, buildSummaryControl } from '../../sessionProtocol';
import {
    getSummaryCategories,
    getSummaryDefaultCategory,
    isSummaryCategory,
    isSummaryFeatureEnabled
} from '../../summary';

function sendSummaryMessage(state: IReduxState, payload: object) {
    const conference = state['features/base/conference'].conference;

    try {
        conference?.sendEndpointMessage?.('', payload);
    } catch (error) {
        // The room transport below is the compatibility fallback.
    }

    try {
        conference?.sendMessage?.({ ...payload }, '', false);
    } catch (error) {
        // A disconnected transport must not crash the call UI.
    }
}

export default function SummarySetupDialog() {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();
    const subtitles = useSelector((state: IReduxState) => state['features/subtitles']);
    const config = useSelector((state: IReduxState) => state['features/base/config']);
    const [ enabled, setEnabled ] = useState(subtitles._summaryStateSynchronized
        ? Boolean(subtitles._summaryEnabled)
        : Boolean(config.aiSummary?.defaultEnabled));
    const [ category, setCategory ] = useState(subtitles._summaryCategory || getSummaryDefaultCategory(config));
    const [ consent, setConsent ] = useState(Boolean(subtitles._interviewConsent));
    const [ categoryOpen, setCategoryOpen ] = useState(false);
    const submitting = useRef(false);
    const categories = useMemo(() => getSummaryCategories(config), [ config.summaryCategories ]);
    const previous = Boolean(subtitles._summaryEnabled);
    const currentCategory = subtitles._summaryCategory || getSummaryDefaultCategory(config);
    const requiresConsent = category === 'interview' && Boolean(config.interviewTelemetry?.requireConsent);
    const canUseSummary = isLocalParticipantModerator(store.getState() as IReduxState)
        && isSummaryFeatureEnabled(config);
    const changed = enabled !== previous
        || category !== currentCategory
        || (requiresConsent && consent !== Boolean(subtitles._interviewConsent));
    const submitEnabled = previous ? !enabled || changed : enabled;
    const submitLabel = previous && !enabled
        ? 'summarySetup.actions.stop'
        : previous ? 'summarySetup.actions.save' : 'summarySetup.actions.start';

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            dispatch(hideDialog('SummarySetupDialog'));

            return true;
        });

        return () => sub.remove();
    }, [ dispatch ]);

    if (!canUseSummary) {
        return null;
    }

    const close = () => dispatch(hideDialog('SummarySetupDialog'));
    const submit = () => {
        if (submitting.current || !submitEnabled || !isLocalParticipantModerator(store.getState() as IReduxState)) {
            return;
        }

        if (!isSummaryCategory(config, category) || !isSummaryFeatureEnabled(config)) {
            return;
        }

        submitting.current = true;
        const before = store.getState() as IReduxState;
        const wasEnabled = Boolean(before['features/subtitles']._summaryEnabled);

        dispatch(setSummaryEnabled(enabled));

        let state = store.getState() as IReduxState;
        const actuallyEnabled = Boolean(state['features/subtitles']._summaryEnabled);

        // A quota/entitlement middleware may reject the enable action. Do not start transcription or announce a
        // state which the store did not accept.
        if (enabled && !actuallyEnabled) {
            submitting.current = false;

            return;
        }

        if (actuallyEnabled) {
            dispatch(setSummaryCategory(category));

            if (!isLiveTranscriptionActive(state)) {
                dispatch(setTranscriptionStartedByCurrentUser(true));
                dispatch(setRequestingSubtitles(true, false, state['features/subtitles']._language));
            }
        } else {
            dispatch(setSummaryCategory(null));
        }

        state = store.getState() as IReduxState;
        const acceptedCategory = state['features/subtitles']._summaryCategory || category;
        const categoryChanged = acceptedCategory !== before['features/subtitles']._summaryCategory;
        const stateChanged = wasEnabled !== actuallyEnabled;

        if (actuallyEnabled && (stateChanged || categoryChanged)) {
            sendSummaryMessage(state, buildSummaryControl(true, acceptedCategory));
        } else if (!actuallyEnabled && (stateChanged || wasEnabled)) {
            sendSummaryMessage(state, buildSummaryControl(false, ''));
        }

        if (actuallyEnabled && category === 'interview') {
            dispatch(setInterviewConsent(consent));
            sendSummaryMessage(store.getState() as IReduxState, buildInterviewConsent(consent));
        }

        dispatch(showNotification({
            descriptionKey: actuallyEnabled
                ? wasEnabled ? 'summarySetup.notifications.saved' : 'summarySetup.notifications.enabled'
                : 'summarySetup.notifications.disabled'
        }, NOTIFICATION_TIMEOUT_TYPE.SHORT));
        submitting.current = false;
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
                <View style = { styles.header }>
                    <View style = { styles.titleRow }>
                        <View style = { styles.iconContainer }>
                            <Icon
                                color = '#FFFFFF'
                                size = { 18 }
                                src = { IconShareDoc } />
                        </View>
                        <Text style = { styles.title }>{ t(previous ? 'summarySetup.settingsTitle' : 'summarySetup.title') }</Text>
                    </View>
                    <Pressable
                        accessibilityLabel = { t('dialog.close', { defaultValue: 'Close' }) }
                        accessibilityRole = 'button'
                        hitSlop = { 12 }
                        onPress = { close }>
                        <Icon
                            color = '#667085'
                            size = { 20 }
                            src = { IconCloseLarge } />
                    </Pressable>
                </View>
                <ScrollView
                    bounces = { false }
                    contentContainerStyle = { styles.content }
                    showsVerticalScrollIndicator = { false }>
                    <Text style = { styles.description }>{ t('summarySetup.description') }</Text>
                    <View style = { styles.row }>
                        <Text style = { styles.rowLabel }>{ t('summarySetup.toggleLabel') }</Text>
                        <Switch
                            accessibilityLabel = { t('summarySetup.toggleLabel') }
                            accessibilityRole = 'switch'
                            ios_backgroundColor = '#554D4D'
                            onValueChange = { setEnabled }
                            testID = 'summary-setup-enabled'
                            thumbColor = '#FFFFFF'
                            trackColor = {{ false: '#554D4D', true: '#EE4136' }}
                            value = { enabled } />
                    </View>
                    <Text style = { styles.label }>{ t('summarySetup.templateLabel') }</Text>
                    <Pressable
                        accessibilityLabel = { t('summarySetup.templateLabel') }
                        accessibilityRole = 'button'
                        accessibilityState = {{ expanded: categoryOpen }}
                        onPress = { () => setCategoryOpen(open => !open) }
                        style = { styles.selector }>
                        <Text style = { styles.selectorText }>{ t(`summarySetup.categories.${category}`, { defaultValue: category }) }</Text>
                        <Icon
                            color = '#667085'
                            size = { 18 }
                            src = { categoryOpen ? IconArrowUp : IconArrowDown } />
                    </Pressable>
                    {categoryOpen && <View style = { styles.options }>
                        {categories.map(value => (<Pressable
                            accessibilityLabel = { t(`summarySetup.categories.${value}`, { defaultValue: value }) }
                            accessibilityRole = 'radio'
                            accessibilityState = {{ selected: category === value }}
                            key = { value }
                            onPress = { () => {
                                setCategory(value);
                                setCategoryOpen(false);
                            } }
                            style = { [ styles.option, category === value && styles.selectedOption ] }>
                            <Text style = { [ styles.optionText, category === value && styles.selectedText ] }>
                                { t(`summarySetup.categories.${value}`, { defaultValue: value }) }
                            </Text>
                        </Pressable>))}
                    </View>}
                    {requiresConsent && <View style = { styles.row }>
                        <Text style = { styles.rowLabel }>{ t('summarySetup.interviewConsent') }</Text>
                        <Switch
                            accessibilityLabel = { t('summarySetup.interviewConsent') }
                            ios_backgroundColor = '#554D4D'
                            onValueChange = { setConsent }
                            thumbColor = '#FFFFFF'
                            trackColor = {{ false: '#554D4D', true: '#EE4136' }}
                            value = { consent } />
                    </View>}
                    <View style = { styles.actions }>
                        <Pressable
                            accessibilityRole = 'button'
                            onPress = { close }
                            style = { styles.cancelButton }
                            testID = 'summary-setup-cancel'>
                            <Text style = { styles.cancelText }>{ t('dialog.cancel', { defaultValue: 'Cancel' }) }</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole = 'button'
                            disabled = { !submitEnabled || submitting.current }
                            onPress = { submit }
                            style = { [
                                styles.submitButton,
                                !submitEnabled && styles.disabledButton,
                                previous && !enabled && styles.stopButton
                            ] }
                            testID = 'summary-setup-submit'>
                            <Text style = { styles.submitText }>{ t(submitLabel) }</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </View>
        </View>
    </Modal>);
}

const styles = StyleSheet.create({
    actions: { flexDirection: 'row', gap: 12, marginTop: 26 },
    backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,.65)', flex: 1, justifyContent: 'center', padding: 24 },
    cancelButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D0D5DD', borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
    cancelText: { color: '#101828', fontSize: 16, fontWeight: '600' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, maxHeight: '90%', overflow: 'hidden', padding: 24, width: '100%' },
    content: { paddingBottom: 4 },
    description: { color: '#667085', fontSize: 15, lineHeight: 22, marginBottom: 20 },
    disabledButton: { backgroundColor: '#FFA09B' },
    header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    iconContainer: { alignItems: 'center', backgroundColor: '#EE4136', borderRadius: 8, height: 36, justifyContent: 'center', width: 36 },
    label: { color: '#101828', fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: 4 },
    option: { justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
    optionText: { color: '#101828', fontSize: 16 },
    options: { backgroundColor: '#FFFFFF', borderColor: '#D0D5DD', borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: 'hidden' },
    row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, minHeight: 48 },
    rowLabel: { color: '#101828', flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 22, marginRight: 16 },
    selectedOption: { backgroundColor: '#F8F9FA' },
    selectedText: { color: '#EE4136', fontWeight: '600' },
    selector: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D0D5DD', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 16 },
    selectorText: { color: '#101828', fontSize: 16 },
    stopButton: { backgroundColor: '#D92D20' },
    submitButton: { alignItems: 'center', backgroundColor: '#EE4136', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
    submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    title: { color: '#101828', fontSize: 20, fontWeight: '700', marginLeft: 12 },
    titleRow: { alignItems: 'center', flexDirection: 'row' }
});
