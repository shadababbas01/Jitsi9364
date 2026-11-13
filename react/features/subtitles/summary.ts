import { IReduxState } from '../app/types';
import { IConfig } from '../base/config/configType';
import { isLocalParticipantModerator } from '../base/participants/functions';

export const DEFAULT_SUMMARY_CATEGORIES = [ 'meeting', 'interview', 'standup' ];

export function getSummaryCategories(config: IConfig) {
    const configured = Array.isArray(config.summaryCategories)
        ? config.summaryCategories
            .filter(category => typeof category === 'string')
            .map(category => category.trim())
            .filter(Boolean)
        : [];
    const unique = configured.filter((category, index) => configured.indexOf(category) === index);

    return unique.length ? unique : DEFAULT_SUMMARY_CATEGORIES;
}

export function getSummaryDefaultCategory(config: IConfig) {
    const categories = getSummaryCategories(config);
    const configuredDefault = typeof config.summaryDefaultCategory === 'string'
        ? config.summaryDefaultCategory.trim()
        : '';

    if (configuredDefault && categories.includes(configuredDefault)) {
        return configuredDefault;
    }

    return categories.includes('meeting') ? 'meeting' : categories[0];
}

export function isSummaryCategory(config: IConfig, category: unknown): category is string {
    return typeof category === 'string' && getSummaryCategories(config).includes(category);
}

export function isSummaryFeatureEnabled(config: IConfig) {
    return config.aiSummary?.enabled !== false;
}

export function canShowGenerateSummary(state: IReduxState) {
    return isLocalParticipantModerator(state)
        && isSummaryFeatureEnabled(state['features/base/config']);
}
