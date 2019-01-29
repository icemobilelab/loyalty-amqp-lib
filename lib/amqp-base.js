'use strict';

const amqp = require('amqplib');
const bluebirdRetry = require('bluebird-retry');
const EventEmitter = require('events').EventEmitter;

/**
 * The AMQP commons defines a common connectivity methods shared
 * between the queue publisher consumer and the exchange consumer
 */


class AMQP extends EventEmitter {

    constructor() {
        //...
    }

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
    _createConnection(host, username, password, logger, retry) {
        let retryCounter = 0;
        const URL = `amqp://${username}:${password}@${host}`;
        const retryConfig = {
            max_tries: retry.maxTries || -1, // eslint-disable-line camelcase
            interval: retry.interval,
            backoff: retry.backoff,
            throw_original: true, // eslint-disable-line camelcase
            max_interval: retry.maxInterval || undefined // eslint-disable-line camelcase
        };
        return bluebirdRetry(() => {
            // Initial connection to AMQP will be retried, settings thereof are configurable
            logger.info({ attemptCount: ++retryCounter }, 'Connecting to AMQP...');
            return amqp.connect(URL).tapCatch((err) => {
                logger.error({ err }, 'Something went wrong while connecting to AMQP. Retrying...');
            });
        }, retryConfig);

    }

    /**
     * Convenience method to get one AMQP connection.
     *
     * @returns {Promise} A promise to a AMQP connection.
     */
    async getConnection(createIfNotExists = true) {

        // if we have a connection, return it
        if (this._connection instanceof EventEmitter) {
            return this._connection;
        } else if (createIfNotExists) {
            const connection = await this._createConnection(
                this.host,
                this.username,
                this.password,
                this.logger,
                this.retry
            );
            this._setConnection(connection);
            return this._connection;
        } else {
            throw new Error('no connection present, and not allowed to put in a new one')
        }
    }

    /**
     *
     * @param {*} connection
     */
    _setConnection(connection) {
        this._connection = connection;
    }


}

module.exports = AMQP;
