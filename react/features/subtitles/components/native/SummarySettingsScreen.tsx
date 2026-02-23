import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    TouchableOpacity,
    View
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { showNotification } from '../../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../../notifications/constants';
import { IReduxState } from '../../../app/types';
import { setTranscriptionStartedByCurrentUser } from '../../../chat/actions.any';
import Button from '../../../base/ui/components/native/Button';
import { BUTTON_TYPES } from '../../../base/ui/constants.native';
import Switch from '../../../base/ui/components/native/Switch';
import Text from '../../../base/react/components/native/Text';
import JitsiScreen from '../../../base/modal/components/JitsiScreen';
import {
    setRequestingSubtitles,
    setSummaryCategory,
    setSummaryEnabled,
    setInterviewConsent
} from '../../actions.any';
import { persistSummaryState } from '../../summaryStateStorage';
import { goBack } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import logger from '../../logger';

import styles from './SummarySettingsScreenStyles';

const SUMMARY_REQUEST_TYPE = 'cc-summary-control';
const INTERVIEW_CONSENT_TYPE = 'interview-consent';
const FALLBACK_SUMMARY_CATEGORIES = [ 'meeting', 'interview', 'standup' ];
const FALLBACK_SUMMARY_CATEGORY = 'meeting';

const SummarySettingsScreen = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const conference = useSelector((state: IReduxState) => state['features/base/conference'].conference);
    const subtitlesState = useSelector((state: IReduxState) => state['features/subtitles']);
    const config = useSelector((state: IReduxState) => state['features/base/config'] as any);
    const {
        summaryCategories,
        summaryDefaultCategory,
        aiSummary,
        interviewTelemetry
    } = config ?? {};
    const supportedCategories = summaryCategories ?? FALLBACK_SUMMARY_CATEGORIES;
    const summaryCategoryDefault = summaryDefaultCategory ?? FALLBACK_SUMMARY_CATEGORY;

    const [enabled, setEnabled] = useState<boolean>(
        typeof subtitlesState._summaryEnabled === 'boolean'
            ? subtitlesState._summaryEnabled
            : Boolean(aiSummary?.defaultEnabled)
    );
    const [category, setCategory] = useState<string>(subtitlesState._summaryCategory || summaryCategoryDefault);

    useEffect(() => {
        setEnabled(
            typeof subtitlesState._summaryEnabled === 'boolean'
                ? subtitlesState._summaryEnabled
                : Boolean(aiSummary?.defaultEnabled)
        );
        setCategory(subtitlesState._summaryCategory || summaryCategoryDefault);
    }, [
        subtitlesState._summaryEnabled,
        subtitlesState._summaryCategory,
        aiSummary?.defaultEnabled,
        summaryCategoryDefault
    ]);

    const previouslyEnabled = Boolean(subtitlesState._summaryEnabled);
    const requestingSubtitles = subtitlesState._requestingSubtitles;
    const collectStats = typeof subtitlesState._interviewConsent === 'boolean'
        ? subtitlesState._interviewConsent
        : Boolean(interviewTelemetry?.requireConsent);

    const categoryOptions = useMemo(() => supportedCategories.map((value: string) => ({
        value,
        label: t(`summarySetup.categories.${value}`, {
            defaultValue: value.charAt(0).toUpperCase() + value.slice(1)
        })
    })), [ supportedCategories, t ]);

    const handleToggle = useCallback(() => {
        setEnabled(prev => !prev);
    }, []);

    const handleCategoryChange = useCallback((value: string) => {
        setCategory(value);
    }, []);

    const sendConferenceJson = useCallback((message: Record<string, any>, context: string) => {
        if (!conference) {
            return;
        }

        try {
            conference?.sendEndpointMessage?.('', message);
        } catch (error) {
            logger.warn(`Failed to send ${context} via endpoint`, error);
        }

        try {
            conference?.sendMessage?.(message);
        } catch (error) {
            logger.warn(`Failed to send ${context} via MUC`, error);
        }
    }, [ conference ]);

    const handleSubmit = useCallback(() => {
        dispatch(setSummaryEnabled(enabled));
        dispatch(setSummaryCategory(category));
        persistSummaryState(conference, enabled ? {
            enabled: true,
            category
        } : undefined);

        if (enabled && !requestingSubtitles) {
            dispatch(setTranscriptionStartedByCurrentUser(true));
            dispatch(setRequestingSubtitles(true, false, null));
        }

        const shouldNotifySummaryControl = enabled || previouslyEnabled !== enabled;

        if (shouldNotifySummaryControl) {
            sendConferenceJson({
                type: SUMMARY_REQUEST_TYPE,
                enabled,
                category
            }, 'summary control');
        }

        if (category === 'interview') {
            dispatch(setInterviewConsent(Boolean(collectStats)));
            sendConferenceJson({
                type: INTERVIEW_CONSENT_TYPE,
                accepted: Boolean(collectStats)
            }, 'interview consent');
        }

        dispatch(showNotification(
            {
                titleKey: enabled
                    ? 'summarySetup.notifications.enabled'
                    : 'summarySetup.notifications.disabled'
            },
            NOTIFICATION_TIMEOUT_TYPE.SHORT
        ));

        goBack();
    }, [
        category,
        collectStats,
        dispatch,
        enabled,
        previouslyEnabled,
        sendConferenceJson,
        conference,
        requestingSubtitles
    ]);

    const statusKey = enabled
        ? 'summarySetup.statusEnabled'
        : 'summarySetup.statusDisabled';

    return (
        <JitsiScreen style = { styles.container }>
            <ScrollView contentContainerStyle = { styles.scrollContent }>
                <View style = { styles.header }>
                    <Text style = { styles.title }>
                        { t('summarySetup.title') }
                    </Text>
                    <Text style = { styles.description }>
                        { t('summarySetup.description') }
                    </Text>
                </View>
                <View style = { styles.section }>
                    <View style = { styles.toggleRow }>
                        <Text style = { styles.toggleLabel }>
                            { enabled
                                ? t('summarySetup.disableLabel')
                                : t('summarySetup.enableLabel') }
                        </Text>
                        <Switch
                            checked = { enabled }
                            onChange = { handleToggle } />
                    </View>
                    <Text style = { styles.statusText }>
                        { t(statusKey) }
                    </Text>
                </View>
                <View style = { styles.section }>
                    <Text style = { styles.sectionLabel }>
                        { t('summarySetup.templateLabel') }
                    </Text>
                    <View style = { styles.categoryList }>
                        { categoryOptions.map(option => (
                            <TouchableOpacity
                                key = { option.value }
                                onPress = { () => handleCategoryChange(option.value) }
                                style = { [
                                    styles.categoryItem,
                                    option.value === category && styles.categoryItemActive
                                ] }>
                                <Text
                                    style = { [
                                        styles.categoryText,
                                        option.value === category && styles.categoryTextActive
                                    ] }>
                                    { option.label }
                                </Text>
                            </TouchableOpacity>
                        )) }
                    </View>
                </View>
                <View style = { styles.footer }>
                    <Button
                        labelKey = 'dialog.Ok'
                        onClick = { handleSubmit }
                        style = { styles.submitButton }
                        type = { BUTTON_TYPES.SECONDARY } />
                </View>
            </ScrollView>
        </JitsiScreen>
    );
};

export default SummarySettingsScreen;