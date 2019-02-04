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
async function _getConnection(base, createIfNotExists = true) {
    // if we have a connection, return it
    if (base._connection instanceof EventEmitter) {
        return base._connection;
    } else if (createIfNotExists) {
        const connection = await _createConnection(
            base.host,
            base.username,
            base.password,
            base.logger,
            base.retry
        );
        _setConnection(base, connection);
        return base._connection;
    } else {
        throw new Error('no connection present, and not allowed to put in a new one');
    }
}

/**
 *
 * @param {*} connection
 */
function _setConnection(base, connection) {
    base._connection = connection;
}

async function _closeConnection(base) {
    const connection = await _getConnection(base, false)
        .catch(err => {
            base.logger.trace({ err }, 'Failed to get a connection to close');
            return null;
        });

    base.logger.info('Closing connection...');
    if (connection) {
        connection.removeAllListeners();
        await connection.close();
    }
    base.logger.info('Connection closed');
    _setConnection(base, undefined);
}

/**
 * Stop the AMQP listener. Connection with AMQP, if present, will be closed.
 *
 * @returns { Promise } A promise to the response of the function Connection#close.
 */
async function _close(base) {
    await _closeConnection(base);
    await _closeChannel(base);
    /**
     * Event fired when the connection to AMQP is closed.
     *
     * @event AMQP#close
     */
    base.emit('close');
}

function _connectionCloseHandler(base, err) {
    // When connection closes, emit AMQP-Base close event
    base.logger.debug('Connection was closed');
    if (err) {
        base.emit('disconnect');
        base.logger.error({ err }, 'Connection was closed with an error, recreating connection...');
        _connect(base)
            .then(() => {
                base.emit('reconnect');
            });
    }
}


/**
 * Connect to AMQP.
 *
 * @returns { Promise } A promise to a AMQP connection.
 */
async function _connect(base) {
    return _getConnection(base)
        .then(connection => {

            connection.once('close', base._connectionCloseHandler.bind(base));

            connection.on('error', (err) => {
                base.logger.error({ err }, 'AMQP Connection errored');
            });

            /**
             * Event fired when the connection to AMQP is successful.
             *
             * @event AMQP#connect
             * @type { object }
             */
            base.emit('connect', connection);
            return connection;
        });
}

/**
 * Gets the channel for base instance, or create a new one if it doesn't exist yet.
 *
 * @returns {Promise} A promise to a AMQP channel.
 */
async function _getChannel(base, recreate = false) {
    if (!base._channel) {
        base._channel = await _createChannel(base, recreate);
    }
    return base._channel;
}

function _setChannel(base, channel) {
    base._channel = channel;
}

async function _closeChannel(base) {
    const channel = await _getChannel(base)
        .catch(err => {
            base.logger.trace({ err }, 'Failed to get channel to clear');
        });
    base.logger.info('Closing channel...');
    if (channel) {
        try {
            channel.removeAllListeners();
            await channel.close();
        } catch (err) {
            if (err.message !== 'Channel closed') { throw err; }
        }
    }
    base.logger.info('Channel closed');
    _setChannel(base, undefined);
}


/**
 * Creates a new channel and handles all possible disconnections.
 *
 * @returns { Promise } A promise to a AMQP channel.
 */
async function _createChannel(base, recreate = false) {
    base.logger.debug('Creating channel...');
    const connection = await _getConnection(base);

    return connection.createChannel()
        .then(channel => {
            base.logger.debug('Channel created');

            channel.once('close', (err) => {
                base.logger.warn('Channel was closed');
                if (err) {
                    base.emit('disconnect');
                    base._createChannel(true)
                        .then(() => {
                            base.emit('reconnect');
                        });
                }
            });

            channel.on('error', () => {
                base.logger.warn({ err }, 'Channel was closed with an error');
            });

            base._channel = channel;

            if (recreate) {
                base.emit('channelRecreate');
            }

            return base._channel;
        }).catch(err => {
            base.logger.error({ err }, 'Could not create the channel, reconnecting....');
            return _createChannel(base, true);
        });
}


module.exports = { AMQP, _getChannel };
