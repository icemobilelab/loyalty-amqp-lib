'use strict';

const amqp = require('amqplib');
const EventEmitter = require('events').EventEmitter;
const bluebirdRetry = require('bluebird-retry');
const amqpCommons = require('./amqp-commons');

/**
 * The AMQP Publisher class. Allows you to connect to and publish to
 * an AMQP exchange.
 *
 * @fires AMQP#connect - When the connection to AMQP connected.
 * @fires AMQP#error - When something goes wrong.
 * @fires AMQP#close - When the connection to AMQP is closed.
 */
class AMQPPublisher extends EventEmitter {

    /**
     * Constructor of the AMQPPublisher listener.
     *
     * @param { object } options - Options object.
     * @param { string } options.host - The AMQP host to connect to.
     * @param { string } options.username - The AMQP username.
     * @param { string } options.password - The AMQP password.
     * @param { function } options.logger - A `bunyan` logger instance.
     * @param { object } options.retry - Retry settings.
     * @param { number } options.retry.maxTries - Amount of retries.
     * @param { number } options.retry.interval - Interval between retries.
     * @param { number } options.retry.backoff - Backoff factor.
     * @param { boolean } options.durable - Whether to use durable exchanges or not.
     * @param { string } options.type - Exchange type (topic/fanout/direct/headers)
     */
    constructor({ host, username, password, logger, retry, durable = false, type = 'topic' }) {
        super();
        this.host = host;
        this.username = username;
        this.password = password;
        this.logger = logger.child({ host, username });
        this.retry = retry;
        this.durable = durable;
        this.type = type;
    }

    /**
     * Start the fun.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    start() {
        return this.connect();
    }

    /**
     * Connect to AMQP.
     *
     * @returns { Promise } A promise to a AMQP connection.
     */
    connect() {
        return this.getConnection().then(conn => {
            this.conn = conn;
            /**
             * Event fired when the connection to AMQP is successful.
             *
             * @event AMQP#connect
             * @type { object }
             */
            this.emit('connect', conn);
            return this.conn;
        });
    }

    /**
     * Creates a new channel and handles all possible disconnections.
     *
     * @returns { Promise } A promise to a AMQP channel.
     */
    createChannel(recreate = false) {
        this.logger.debug('Creating channel...');
        if (!this.conn) {
            return Promise.reject(new Error('No connection'));
        }
        return this.conn.createChannel().then(channel => {
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
                this.conn = conn;
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
    publish(exchange, message, route='') {
        const publishLogger = this.logger.child({ exchange });
        publishLogger.debug({ message }, 'Publishing message...');

        return this.getChannel()
            .then(channel => {
                let ok = this.assertExchange(channel, exchange);
                return ok.then(() => {
                    publishLogger.info('Publishing message');
                    publishLogger.debug({ message }, 'Publishing message');
                    return channel.publish(exchange, route, Buffer.from(message));
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
    stop() {
        if (!this.conn) {
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
        const res = this.conn.close();
        this.logger.info('Connection closed');
        this.conn = undefined;
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
