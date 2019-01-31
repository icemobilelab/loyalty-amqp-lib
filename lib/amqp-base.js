'use strict';
const amqp = require('amqplib');
const bluebirdRetry = require('bluebird-retry');
const EventEmitter = require('events').EventEmitter;

/**
 * The AMQP commons defines a common connectivity methods shared
 * between the queue publisher consumer and the exchange consumer
 */


class AMQP extends EventEmitter {

    constructor(options) {
        super();
        Object.assign(this, options);
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
    async _getConnection(createIfNotExists = true) {

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
            throw new Error('no connection present, and not allowed to put in a new one');
        }
    }

    /**
     *
     * @param {*} connection
     */
    _setConnection(connection) {
        this._connection = connection;
    }

    async _closeConnection() {
        const connection = await this._getConnection(false)
            .catch(err => {
                this.logger.trace({ err }, 'Failed to get a connection to close');
                return null;
            });

        this.logger.info('Closing connection...');
        if (connection) {
            connection.removeAllListeners();
            connection.close();
        }
        this.logger.info('Connection closed');
        this._setConnection(undefined);
    }

    /**
  * Stop the AMQP listener. Connection with AMQP, if present, will be closed.
  *
  * @returns { Promise } A promise to the response of the function Connection#close.
  */
    async stop() {
        await this._closeConnection();
        await this._closeChannel();
        /**
         * Event fired when the connection to AMQP is closed.
         *
         * @event AMQP#close
         */
        this.emit('close');
    }

    _connectionCloseHandler(err) {
        // When connection closes, emit AMQP-Base close event
        this.logger.debug('Connection was closed');
        if (err) {
            this.logger.error({ err }, 'Connection was closed with an error, recreating connection...');
            this.connect()
                .then(() => {
                    this.emit('reconnect');
                });
        }
    }


    /**
     * Connect to AMQP.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    async connect() {
        return this._getConnection()
            .then(connection => {
                connection.once('close', this._connectionCloseHandler.bind(this));

                connection.on('error', (err) => {
                    this.logger.error({ err }, 'AMQP Connection errored');
                });

                /**
                 * Event fired when the connection to AMQP is successful.
                 *
                 * @event AMQP#connect
                 * @type { object }
                 */
                this.emit('connect', connection);
                return connection;
            });
    }

    /**
     * Start the fun.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    async start() {
        await this.connect();
        return;
    }

    /**
     * Gets the channel for this instance, or create a new one if it doesn't exist yet.
     *
     * @returns {Promise} A promise to a AMQP channel.
     */
    async getChannel(recreate = false) {
        if (!this._channel) {
            this._channel = await this.createChannel(recreate);
        }
        return this._channel;
    }

    _setChannel(channel) {
        this._channel = channel;
    }

    async _closeChannel() {
        const channel = await this.getChannel()
            .catch(err => {
                this.logger.trace({ err }, 'Failed to get channel to clear');
            });
        this.logger.info('Closing channel...');
        if (channel) {
            channel.removeAllListeners();
            channel.close();
        }
        this.logger.info('Channel closed');
        this._setChannel(undefined);
    }


    /**
     * Creates a new channel and handles all possible disconnections.
     *
     * @returns { Promise } A promise to a AMQP channel.
     */
    async createChannel(recreate = false) {
        this.logger.debug('Creating channel...');
        const connection = await this._getConnection();

        return connection.createChannel()
            .then(channel => {
                this.logger.debug('Channel created');

                channel.once('close', () => {
                    this.logger.warn('Channel was closed');
                    this.createChannel(true);
                });

                channel.on('error', () => {
                    this.logger.warn({ err }, 'Channel was closed with an error');
                });

                this._channel = channel;

                if (recreate) {
                    this.emit('channelRecreate');
                }

                return this._channel;
            }).catch(err => {
                this.logger.error({ err }, 'Could not create the channel, reconnecting....');
                return this.createChannel(true);
            });
    }

}

module.exports = AMQP;
