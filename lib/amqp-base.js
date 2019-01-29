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

    /**
  * Stop the AMQP listener. Connection with AMQP, if present, will be closed.
  *
  * @returns { Promise } A promise to the response of the function Connection#close.
  */
    async stop() {

        if (!this.connection) {
            this.logger.warn('There is no open connection');
            return Promise.resolve({});
        }

        if (this.connection instanceof EventEmitter) {
            this.connection.removeAllListeners();
        }

        if (this.channel) {
            this.logger.info('Closing channel...');
            this.channel.removeAllListeners();
            this.channel.close();
            this.logger.info('Channel closed');
            this.channel = undefined;
        }
        this.logger.info('Closing connection...');
        const res = this.connection.close();
        this.logger.info('Connection closed');
        this.connection = undefined;
        /**
         * Event fired when the connection to AMQP is closed.
         *
         * @event AMQP#close
         */
        this.emit('close');
        return res;
    }


    /**
     * Connect to AMQP.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    async connect() {
        return this.getConnection()
            .then(conn => {
                this.connection = conn;
                this.connection.once('close', (err) => {
                    this.logger.debug({ err }, 'Connection was closed');
                    this.emit('close', err);

                    if (err) {
                        this.logger.error({ err }, 'Connection was closed with an error, creating new connection...');
                        this.connect();
                    }
                });

                this.connection.on('error', (err) => {
                    this.logger.error({ err }, 'AMQP Connection errored');
                });

                /**
                 * Event fired when the connection to AMQP is successful.
                 *
                 * @event AMQP#connect
                 * @type { object }
                 */
                this.emit('connect', this.connection);
                return this.connection;
            });
    }


    /**
     * Start the fun.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    async start() {
        await this.connect();
    }

    /**
     * Gets the channel for this instance, or create a new one if it doesn't exist yet.
     *
     * @returns {Promise} A promise to a AMQP channel.
     */
    getChannel() {
        if (!this.channel) {
            this.channel = this.createChannel();
        }
        return Promise.resolve(this.channel);
    }



    /**
     * Creates a new channel and handles all possible disconnections.
     *
     * @returns { Promise } A promise to a AMQP channel.
     */
    async createChannel(recreate = false) {
        this.logger.debug('Creating channel...');
        if (!this.connection) {
            return Promise.reject(new Error('No connection'));
        }
        return this.connection.createChannel().then(channel => {
            this.logger.debug('Channel created');

            channel.once('close', () => {
                this.logger.warn('Channel was closed');
                this.createChannel(true);
            });

            this.channel = channel;

            if (recreate === true) {
                this.emit('channelRecreate');
            }

            return this.channel;
        }).catch(err => {
            this.logger.error({ err }, 'Could not create the channel, reconnecting....');
            this.getConnection().then(conn => {
                this.connection = conn;
                return this.createChannel(true);
            });
        });
    }




}

module.exports = AMQP;
