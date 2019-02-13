'use strict';
const amqp = require('amqplib');
const Bluebird = require('bluebird');
const bluebirdRetry = require('bluebird-retry');
const { EventEmitter } = require('events');
const locks = require('locks');
const assert = require('assert');
const requiredArgs = ['logger', 'serviceName', 'host', 'username', 'password', 'exchange', 'exchangeType', 'route'];

/**
 * @type { AMQP } - A class for interacting with AMQP brokers
 */
class AMQP extends EventEmitter {

    /**
     * Constructor of the AMQP base.
     *
     * @param { object } options - Options object.
     */
    constructor(options) {
        super();
        // Validate arguments
        assert.ok(options, 'No options passed to AMQP lib');
        requiredArgs.map(arg => assert.ok(options[arg], `No ${arg} passed to AMQP lib`));

        Object.assign(this, options);
        this.lock = locks.createReadWriteLock();
    }

    /**
     * Closes the connection and channel
     * Emits a close event when completed
     */
    async stop() {
        await _closeChannel(this);
        await _closeConnection(this);
        /**
         * Event fired when the connection to AMQP is closed.
         *
         * @event AMQP#close
         */
        this.emit('close');
    }
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
function _createConnection(host, username, password, logger, retry) {
    let retryCounter = 0;
    const URL = `amqp://${username}:${password}@${host}`;
    const retryConfig = _getRetryConfig(retry);

    return bluebirdRetry(() => {
        // Initial connection to AMQP will be retried, settings thereof are configurable
        logger.info({ attemptCount: ++retryCounter }, 'Connecting to AMQP...');
        return amqp.connect(URL).tapCatch((err) => {
            logger.error({ err }, 'Something went wrong while connecting to AMQP. Retrying...');
        });
    }, retryConfig);
}

/**
 * Method for composing a retry config object, sets defaults for
 * max_tries when not passed in.
 *
 * @param { object } retryOptions - Retry settings.
 * @param { number } retryOptions.maxTries - Amount of retries.
 * @param { number } retryOptions.interval - Interval between retries.
 * @param { number } retryOptions.backoff - Backoff factor.
 */
function _getRetryConfig(retryOptions = {}) {
    if ('maxTries' in retryOptions) {
        retryOptions.max_tries = retryOptions.maxTries; // eslint-disable-line camelcase
        delete retryOptions.maxTries;
    }

    const defaults = { max_tries: -1 }; // eslint-disable-line camelcase
    const overrides = { throw_original: true }; // eslint-disable-line camelcase
    return { ...defaults, ...retryOptions, ...overrides };
}

/**
 * Wrapper method for lock.readLock
 *
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns {Promise} A promise that resolves once the lock has been read
 */
async function _lockReads(base) {
    return new Bluebird((resolve) => {
        base.lock.readLock(resolve);
    });
}

/**
 * Wrapper method for lock.writeLock
 *
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns {Promise} A promise that resolves once the lock has been written to
 */
async function _lockWrites(base) {
    return new Bluebird((resolve) => {
        base.lock.writeLock(resolve);
    });
}

/**
 * Wrapper method for lock.unlock
 *
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns {Promise} A promise
 */
function _unlock(base) {
    base.lock.unlock();
}

/**
 * Convenience method to get one AMQP connection.
 *
 * @returns {Promise} A promise to a AMQP connection.
 */
async function _getConnection(base, createIfNotExists = true) {
    // Read existing connection
    await _lockReads(base);
    const connection = base._connection;
    _unlock(base);

    if (connection instanceof EventEmitter) {
        return connection;
    } else if (createIfNotExists) {
        // Create a new connection
        await _lockWrites(base);
        await _connect(base)
            .catch(err => {
                base.logger.error({ err }, 'Failed to create connection to AMQP');
                throw err;
            });
        _unlock(base);

        return _getConnection(base, false);
    } else {
        throw new Error('no connection present, and not allowed to create a new one');
    }
}

/**
 * Set the internal (private) connection to AMQP
 *
 * @param { AMQP } base - Instance of an AMQP class
 * @param {*} connection
 */
function _setConnection(base, connection) {
    base._connection = connection;
}

/**
 * Close an existing connection on the supplied base class
 * Will also remove any event listeners
 *
 * @param { AMQP } base - Instance of an AMQP class
 */
async function _closeConnection(base) {
    const connection = await _getConnection(base, false)
        .catch(err => {
            base.logger.trace({ err }, 'Failed to get a connection to close');
            return null;
        });

    base.logger.info('Closing connection...');
    _setConnection(base, undefined);
    if (connection) {
        connection.removeAllListeners();
        try {
            await connection.close();
        } catch (err) {
            if (err.message !== 'Connection closed (ReferenceError: err is not defined)') {
                base.logger.error({ err }, 'Error closing connection');
                throw err;
            }
        }
    }
    base.logger.info('Connection closed');
}

/**
 * Method to be executed when a close event occurs on a connection
 *
 * @param { AMQP } base - Instance of an AMQP class
 * @param {*} err
 */
async function _connectionCloseHandler(base, err) {

    // When connection closes, emit AMQP-Base close event
    base.logger.error({ err }, 'Connection was closed with an error, recreating connection...');
    base.emit('disconnect');
    await _closeChannel(base);
    await _connect(base, true);
    await _createChannel(base);
}

/**
 * Connect to AMQP.
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns { Promise } A promise to an AMQP connection.
 */
async function _connect(base, reconnect = false) {

    let connection = base._connection;
    if (!(connection instanceof EventEmitter)) {
        connection = await _createConnection(
            base.host,
            base.username,
            base.password,
            base.logger,
            base.retry
        );
        _setConnection(base, connection);
    }

    connection.once('close', _connectionCloseHandler.bind({}, base));

    connection.on('error', (err) => {
        base.logger.error({ err }, 'AMQP Connection errored');
    });

    /**
     * Event fired when the connection to AMQP is successful.
     *
     * @event AMQP#connect
     * @type { object }
     */
    base.emit(reconnect ? 'reconnect' : 'connect');
    return connection;
}

/**
 * Gets the channel for base instance, or create a new one if it doesn't exist yet.
 *
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns {Promise} A promise to a AMQP channel.
 */
async function _getChannel(base) {
    if (!base._channel) {
        base._channel = await _createChannel(base)
            .then(channel => {
                // Verify channel health by checking existence of a default exchange
                return channel.checkExchange('amq.direct')
                    .then(() => {
                        return channel;
                    });
            })
            .catch(err => {
                base.logger.error({ err }, 'Failed to create channel');
                throw err;
            });
    }
    return base._channel;
}

/**
 * Set the internal (private) channel to AMQP
 *
 * @param { AMQP } base - Instance of an AMQP class
 * @param {*} channel
 */
function _setChannel(base, channel) {
    base._channel = channel;
}

/**
 * Close an existing channel on the supplied base class
 *
 * @param { AMQP } base - Instance of an AMQP class
 */
async function _closeChannel(base) {
    const channel = await _getChannel(base)
        .catch(err => {
            base.logger.trace({ err }, 'Failed to get channel to clear');
        });
    base.logger.info('Closing channel...');
    _setChannel(base, undefined);
    if (channel) {
        channel.removeAllListeners();
        try {
            await channel.close();
        } catch (err) {
            if (err.message !== 'Channel closed') {
                base.logger.error({ err }, 'Error closing channel');
                throw err;
            }
        }
    }
    base.logger.info('Channel closed');
}

/**
 * Creates a new channel and handles all possible disconnections.
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns { Promise } A promise to an AMQP channel.
 */
async function _createChannel(base) {
    base.logger.debug('Creating channel...');
    const connection = await _getConnection(base)
        .catch(err => {
            base.logger.error({ err }, 'Failed to get connection while creating channel');
            throw err;
        });

    return connection.createChannel()
        .then(channel => {
            base.logger.debug('Channel created');

            channel.once('close', (err) => {
                base.logger.warn({ err }, 'Channel was closed');
                base.emit('disconnect');
                _createChannel(base)
                    .then(() => {
                        base.emit('reconnect');
                    });
            });

            channel.on('error', (err) => {
                base.logger.warn({ err }, 'Channel was closed with an error');
            });

            base._channel = channel;

            return base._channel;
        }).catch(err => {
            base.logger.error({ err }, 'Could not create the channel');
            throw err;
        });
}

/**
 * Returns a function which processes incoming messages from the
 * channel and fires the message event with the input.
 *
 * @param { AMQP } base - Instance of an AMQP class
 * @param { function } queueLogger - Logger
 *
 * @returns { function } function for processing incoming messages
 */
function _getChannelConsumer(base, queueLogger) {
    return (data => {
        const message = data.content.toString();
        queueLogger.trace({
            fields: data.fields, message,
        }, 'Received data from queue');
        queueLogger.debug('Received message from queue');
        /**
         * Event fired when a message is received in the queue.
         *
         * @event AMQP#message
         */
        base.emit('message', message, data);
    }).bind(base);
}

module.exports = { AMQP, _getChannel, _getChannelConsumer };
