// @ts-ignore
import { safeJsonParse } from '@jitsi/js-utils/json';
import { NativeModules } from 'react-native';

import { loadScript } from '../util/loadScript.native';

import logger from './logger';

export * from './functions.any';

const { JavaScriptSandbox } = NativeModules;

/**
 * Loads config.js from a specific remote server.
 *
 * @param {string} url - The URL to load.
 * @returns {Promise<Object>}
 */
export async function loadConfig(url: string): Promise<Object> {
    try {
        const configTxt = await loadScript(url, 10 * 1000 /* Timeout in ms */, true /* skipeval */);
        // meet.jit.si started serving websocket URL as a template literal:
        // websocket: `wss://...${subdomain}`
        // The JS sandbox used by this app version may fail to parse that syntax.
        // Normalize it to string concatenation before evaluation.
        const normalizedConfigTxt = configTxt.replace(
            /websocket:\s*`([^`$]*)\$\{subdomain\}([^`]*)`/g,
            "websocket: '$1' + subdomain + '$2'");
        const configJson = await JavaScriptSandbox.evaluate(`${normalizedConfigTxt}\nJSON.stringify(config);`);
        const config = safeJsonParse(configJson);

        if (typeof config !== 'object') {
            throw new Error('config is not an object');
        }

        logger.info(`Config loaded from ${url}`);

        return config;
    } catch (err) {
        logger.error(`Failed to load config from ${url}`, err);

        throw err;
    }
}
