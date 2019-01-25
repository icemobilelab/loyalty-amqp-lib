'use strict';

const amqp = require('amqplib');
const bluebirdRetry = require('bluebird-retry');

/**
 * The AMQP commons defines a common connectivity methods shared
 * between the queue publisher consumer and the exchange consumer
 */

module.exports = {

    /**
     * General connection generator for the AMQP server
     *
     * @param { string } host - The AMQP host to connect to.
     * @param { string } username - The AMQP username.
     * @param { string } password - The AMQP password.
     * @param { function } logger - A `bunyan` logger instance.
     * @param { object } retry - Retry settings.
     * @param { number } retry.maxTries - Amount of retries.
     * @param { number } retry.interval - Interval between retries.
     * @param { number } retry.backoff - Backoff factor.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    getConnection: function(host, username, password, logger, retry) {
        let retryCounter = 0;
        const URL = `amqp://${ username }:${ password }@${ host }`;
        const retryConfig = {
            max_tries: retry.maxTries || -1, // eslint-disable-line camelcase
            interval: retry.interval,
            backoff: retry.backoff,
            throw_original: true // eslint-disable-line camelcase
        };
        if (retry.maxInterval) {
            retryConfig.max_interval = retry.maxInterval; // eslint-disable-line
        }
        return bluebirdRetry(() => {
            // Initial connection to AMQP will be retried, settings thereof are configurable
            logger.info({ attemptCount: ++retryCounter }, 'Connecting to AMQP...');
            return amqp.connect(URL).tapCatch((err) => {
                logger.error({ err }, 'Something went wrong while connecting to AMQP. Retrying...');
            });
        }, retryConfig);

    }
};
