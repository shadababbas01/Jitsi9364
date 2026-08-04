/**
 * The type of the action which adds a debug event log entry.
 *
 * @returns {{
 *     type: LOG_EVENT,
 *     entry: Object
 * }}
 */
export const LOG_EVENT = 'LOG_EVENT';

/**
 * The type of the action which clears debug event logs.
 *
 * @returns {{
 *     type: CLEAR_EVENT_LOG
 * }}
 */
export const CLEAR_EVENT_LOG = 'CLEAR_EVENT_LOG';
