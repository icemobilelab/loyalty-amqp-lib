'use strict';
const AMQP = require('./amqp-base');
const config = require('./../config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
    name: config.get('log.name'),
    level: config.get('log.level')
});

/**
 * The AMQP Publisher class. Allows you to connect to and publish to
 * an AMQP exchange.
 *
 * @fires AMQP#connect - When the connection to AMQP connected.
 * @fires AMQP#error - When something goes wrong.
 * @fires AMQP#close - When the connection to AMQP is closed.
 */
class AMQPPublisher extends AMQP {

    /**
     * Constructor of the AMQPPublisher listener.
     *
     * @param { object } options - Options object.
     * @param { string } options.host - The AMQP host to connect to.
     * @param { string } options.username - The AMQP username.
     * @param { string } options.password - The AMQP password.
     * @param { object } options.retry - Retry settings.
     * @param { number } options.retry.maxTries - Amount of retries.
     * @param { number } options.retry.interval - Interval between retries.
     * @param { number } options.retry.backoff - Backoff factor.
     * @param { boolean } options.durable - Whether to use durable exchanges or not.
     * @param { string } options.type - Exchange type (topic/fanout/direct/headers)
     */
    constructor({ host, username, password, retry, durable = false, type = 'topic' }) {
        super();
        Object.assign(this,
            {
                host,
                username,
                password,
                retry,
                durable,
                type,
                logger // logger: logger.child({ host, username }),
            }
        );
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
     * Connect to AMQP.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    async connect() {
        return this.getConnection().then(conn => {
            this.connection = conn;
            /**
             * Event fired when the connection to AMQP is successful.
             *
             * @event AMQP#connect
             * @type { object }
             */
            this.emit('connect', conn);
            return this.connection;
        });
    }

    /**
     * Convenience method to get one AMQP connection.
     *
     * @returns {Promise} A promise to a AMQP connection.
     */
    getConnection() {
        if (!this.connection) {
            this.connection = amqpCommons.getConnection(
                this.host,
                this.username,
                this.password,
                this.logger,
                this.retry
            );
        }
        return this.connection;
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

    /**
     * Assert a valid exchange declaration that corresponds to the
     * server definition (if exchange exist previously)
     */
    assertExchange(channel, exchange) {
        var config = {
            durable: this.durable
        };
        return channel.assertExchange(exchange, this.type, config);
    }

    /**
     * Publish a message in the exchange.
     *
     * @param { string } exchange - Queue to publish the message to.
     * @param { string } message - The message to publish.
     * @param { string } route - Routing key for the message.
     *
     * @returns { Promise } A promise to the response of the function Channel#publish
     */
    async publish(exchange, message, route = '') {
        const publishLogger = this.logger.child({ exchange });
        publishLogger.debug({ message }, 'Publishing message...');

        return this.getChannel()
            .then(channel => {
                let ok = this.assertExchange(channel, exchange);
                return ok.then(() => {
                    publishLogger.info('Publishing message');
                    publishLogger.debug({ message }, 'Publishing message');
                    return channel.publish(exchange, route, Buffer.from(message), { persistent: true });
                });
            }).catch(err => {
                publishLogger.error({ err }, 'Something went wrong');
                this.emit('error', err);
            });
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
     * Abstract method to publish normal (happy) messages.
     *
     * @abstract
     */
    publishMessage(message, route = '') { // eslint-disable-line no-unused-vars
        throw new Error('Must be implemented by the subclass.');
    }

    /**
     * Abstract method to publish error messages.
     *
     * @abstract
     */
    publishError(error) { // eslint-disable-line no-unused-vars
        throw new Error('Must be implemented by the subclass.');
    }
}

module.exports = AMQPPublisher;
