import PersistenceRegistry from '../redux/PersistenceRegistry';
import ReducerRegistry from '../redux/ReducerRegistry';
import { equals } from '../redux/functions';

import {
    INCREMENT_FEATURE_USAGE,
    SET_DELAYED_LOAD_OF_AVATAR_URL,
    SET_JWT,
    SET_KNOWN_AVATAR_URL
} from './actionTypes';
import logger from './logger';

export interface IFeatureUsageLimit {
    alertlimit?: number;
    enabled?: boolean;
    limit?: number;
    used?: number;
}

export type IFeatureUsageLimits = Record<string, IFeatureUsageLimit>;
export type IFeatureAccessFlags = Record<string, boolean>;

export interface IJwtState {
    callee?: {
        name: string;
    };
    delayedLoadOfAvatarUrl?: string;
    featureAccessFlags?: IFeatureAccessFlags;
    featureUsageLimits?: IFeatureUsageLimits;
    group?: string;
    jwt?: string;
    knownAvatarUrl?: string;
    roomName?: string;
    server?: string;
    tenant?: string;
    user?: {
        id: string;
        name: string;
    };
}

PersistenceRegistry.register('features/base/jwt', {
    knownAvatarUrl: true
});

/**
 * Reduces redux actions which affect the JSON Web Token (JWT) stored in the
 * redux store.
 *
 * @param {Object} state - The current redux state.
 * @param {Object} action - The redux action to reduce.
 * @returns {Object} The next redux state which is the result of reducing the
 * specified {@code action}.
 */
ReducerRegistry.register<IJwtState>(
    'features/base/jwt',
    (state = {}, action): IJwtState => {
        switch (action.type) {
        case SET_DELAYED_LOAD_OF_AVATAR_URL: {
            const nextState = {
                ...state,
                delayedLoadOfAvatarUrl: action.avatarUrl
            };

            if (equals(state, nextState)) {
                return state;
            }

            logger.info('JWT avatarURL temporarily not loaded till jwt is verified on connect');

            return nextState;
        }
        case SET_JWT: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...payload } = action;
            const nextState = {
                ...state,
                ...payload
            };

            return equals(state, nextState) ? state : nextState;
        }
        case INCREMENT_FEATURE_USAGE: {
            const currentLimits = state.featureUsageLimits || {};
            const currentFeature = currentLimits[action.feature];

            if (!currentFeature) {
                return state;
            }

            const nextState = {
                ...state,
                featureUsageLimits: {
                    ...currentLimits,
                    [action.feature]: {
                        ...currentFeature,
                        used: Number(currentFeature.used || 0) + 1
                    }
                }
            };

            return equals(state, nextState) ? state : nextState;
        }
        case SET_KNOWN_AVATAR_URL:
            return {
                ...state,
                knownAvatarUrl: action.avatarUrl
            };
        }

        return state;
    });
