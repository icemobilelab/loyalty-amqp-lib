import amqp from 'amqplib';
import pRetry from 'p-retry';
import { EventEmitter } from 'events';
import locks from 'locks';
import assert from 'assert';

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

    const requiredArgs = ['serviceName', 'host', 'username', 'password', 'logger'];
    // Validate arguments
    assert.ok(options, 'No options passed to AMQP lib');
    requiredArgs.map((arg) => assert.ok(options[arg], `No ${arg} passed to AMQP lib`));

    Object.assign(this, options);
    this.lock = locks.createReadWriteLock();
    this.connectionClosed = false;

    this.once('disconnect', () => {
      _reconnect(this);
    });
  }

  /**
   * Closes the connection and channel
   * Emits a close event when completed
   */
  async stop() {
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

  return pRetry(() => {
    // Initial connection to AMQP will be retried, settings thereof are configurable
    logger.info({ attemptCount: ++retryCounter }, 'Connecting to AMQP...');
    return amqp.connect(URL).catch((err) => {
      logger.error({ err }, 'Something went wrong while connecting to AMQP. Retrying...');
      throw err;
    });
  }, _mapBluebirdRetryOptionsToPRetryOptions(retryConfig));
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
  return new Promise((resolve) => {
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
  return new Promise((resolve) => {
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
  if (base.lock.isLocked) {
    base.lock.unlock();
  }
}

/**
 * Convenience method to get one AMQP connection.
 *
 * @returns {Promise} A promise to a AMQP connection.
 */
async function _getConnection(base, createIfNotExists = true) {
  // Read the existing connection
  await _lockReads(base);
  const connection = base._connection;
  _unlock(base);

  if (connection instanceof EventEmitter) {
    return connection;
  } else if (createIfNotExists) {
    // Create a new connection
    await _connect(base).catch((err) => {
      base.logger.error({ err }, 'Failed to create connection to AMQP');
      throw err;
    });

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
  const connection = await _getConnection(base, false).catch((err) => {
    base.logger.trace({ err }, 'Failed to get a connection to close');
    return null;
  });
  base.logger.info('Closing connection...');
  if (connection) {
    connection.removeAllListeners();
    const channel = await _getChannel(base, false);
    if (channel) {
      channel.removeAllListeners();
    }
    _setConnection(base, undefined);
    _setChannel(base, undefined);
    if (!base.connectionClosed) {
      try {
        base.connectionClosed = true;
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
  base.connectionClosed = true;
  // Only reconnect on error. Non-error close implies manual close
  if (err) {
    base.emit('disconnect');
  }
}

async function _reconnect(base) {
  base.logger.info({ queue: base.queue }, 'Reconnect requested. Sleeping for 2 seconds before reconnecting...');
  await new Promise((resolve) => void setTimeout(resolve, 2000));
  await _closeConnection(base);
  await _connect(base, true);
  base.once('disconnect', () => {
    _reconnect(base);
  });
}

const openConnections = [];
async function closeOpenConnections() {
  await Promise.allSettled(openConnections.map((c) => c.close()));
}

process.once('SIGINT', closeOpenConnections);
process.once('SIGTERM', closeOpenConnections);

/**
 * Connect to AMQP.
 * @param { AMQP } base - Instance of an AMQP class
 * @param { boolean } reconnect - default `false`, whether to reconnect if connection dead
 *
 * @returns { Promise } A promise to an AMQP connection.
 */
async function _connect(base, reconnect = false) {
  let connection = base._connection;
  if (!(connection instanceof EventEmitter)) {
    await _lockWrites(base);

    connection = await _createConnection(base.host, base.username, base.password, base.logger, base.retry);
    _setConnection(base, connection);
    base.connectionClosed = false;
    _unlock(base);
    await _createChannel(base);

    // Clean up when a process terminated or interrupted
    openConnections.push(connection);

    connection.once('close', (err) => {
      // Remove calls to `connection.close`, since the connection was closed already
      openConnections.splice(openConnections.indexOf(connection), 1);
      _connectionCloseHandler(base, err);
    });

    connection.on('error', (err) => {
      base.logger.error({ err }, 'AMQP Connection errored');
    });
  }

  /**
   * Event fired when the connection to AMQP is successful.
   *
   * @event AMQP#connect
   * @type { object }
   */
  base.emit(reconnect ? 'reconnect' : 'connect');
  return connection;
}

async function _checkChannel(base, channel) {
  // Verify channel health by checking existence of a default exchange
  return channel
    .checkExchange('amq.direct')
    .then(() => {
      return channel;
    })
    .catch((err) => {
      base.logger.debug({ err }, 'Channel is unhealthy');
      throw err;
    });
}

/**
 * Gets the channel for base instance, or create a new one if it doesn't exist yet.
 *
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @param createIfNotExists
 * @returns {Promise} A promise to an AMQP channel.
 */
async function _getChannel(base, createIfNotExists = true) {
  await _lockReads(base);
  const currentChannel = base._channel;
  _unlock(base);
  if (currentChannel) {
    return currentChannel;
  } else if (createIfNotExists) {
    try {
      const channel = await _createChannel(base);
      _lockWrites(base);
      base._channel = await _checkChannel(base, channel);
      _unlock(base);
    } catch (err) {
      base.logger.error({ err }, 'Failed to create channel');
      _unlock(base);
      throw err;
    }
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
 * Creates a new channel and handles all possible disconnections.
 * @param { AMQP } base - Instance of an AMQP class
 *
 * @returns { Promise } A promise to an AMQP channel.
 */
async function _createChannel(base) {
  base.logger.debug('Creating channel...');
  const connection = await _getConnection(base, false).catch((err) => {
    base.logger.error({ err }, 'Failed to get connection while creating channel');
    throw err;
  });

  await _lockWrites(base);
  return connection
    .createChannel()
    .then((channel) => {
      base.logger.debug('Channel created');

      channel.once('close', (err) => {
        base.logger.info({ err }, 'Channel was closed');
        base.emit('disconnect');
      });

      channel.once('error', (err) => {
        base.logger.warn({ err }, 'Channel was closed with an error');
      });

      _setChannel(base, channel);

      _unlock(base);
      return channel;
    })
    .catch((err) => {
      base.logger.error({ err }, 'Could not create the channel');
      _unlock(base);
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
  return function (data) {
    if (!data) {
      base.emit('disconnect');
    } else {
      const message = data.content.toString();
      queueLogger.trace(
        {
          fields: data.fields,
          message,
        },
        'Received data from queue',
      );
      queueLogger.debug('Received message from queue');
      /**
       * Event fired when a message is received in the queue.
       *
       * @event AMQP#message
       */
      base.emit('message', message, data);
    }
  }.bind(base);
}

function _logAndThrowErr(description, logger) {
  return (err) => {
    logger.error({ err }, description);
    throw err;
  };
}

/**
 * Converts a `bluebird-retry` config to a `p-retry` config, keeping the former's default
 * values to ensure backwards compatibility.
 *
 * **NOTE**: This function only maps properties documented/used by the AMQP Class.
 * **NOTE 2**: In regard to `throw_original`, throwing the original Error is `p-retry`'s default behavior.
 *
 * @param {*} bluebirdRetryConfig a `bluebird-retry` config object
 * @returns a config object ready to use with `p-retry`
 */
function _mapBluebirdRetryOptionsToPRetryOptions(bluebirdRetryConfig) {
  const pRetryConfig = {};
  pRetryConfig.minTimeout = bluebirdRetryConfig.interval || 1000;
  pRetryConfig.maxTimeout = bluebirdRetryConfig.max_interval || Infinity;
  pRetryConfig.factor = bluebirdRetryConfig.backoff || 1;

  // bluebird-retry's `max_tries` property determines the total number of times to attempt an operation
  // (default 5). p-retry's `retries` property is the number of times to retry the operation, total number
  // of attempts is `retries + 1`
  pRetryConfig.retries = bluebirdRetryConfig.max_tries >= 0 ? bluebirdRetryConfig.max_tries - 1 : 4;

  // Based on `bluebird-retry`'s documentation:
  //
  // > If `max_tries` is set to -1 and no `timeout` is specified, retry will be performed forever.
  /* istanbul ignore else */
  if (bluebirdRetryConfig.max_tries === -1 && !bluebirdRetryConfig.timeout) {
    pRetryConfig.forever = true;
  }

  return pRetryConfig;
}

export {
  AMQP,
  _getChannel,
  _getChannelConsumer,
  _checkChannel,
  _logAndThrowErr,
  _getConnection,
  _connect,
  _createChannel,
  _reconnect,
  _connectionCloseHandler,
  _createConnection,
  _getRetryConfig,
  _mapBluebirdRetryOptionsToPRetryOptions,
  _setChannel,
  _setConnection,
};
