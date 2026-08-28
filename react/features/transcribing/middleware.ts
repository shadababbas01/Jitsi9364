import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import './subscriber';

/**
 * Implements the middleware of the feature transcribing.
 *
 * The transcriber bot leaving used to raise a "transcribing failed" notification. Captions are produced on each
 * participant's own device now, so a bot leaving - or never having been there, which is the ordinary case - says
 * nothing about whether captions are working, and the notification only ever appeared over a session which was fine.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(() => next => action => next(action));
