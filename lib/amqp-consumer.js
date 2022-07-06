'use strict';

const {
    AMQP,
    _getConnection,
    _getChannel,
    _getChannelConsumer,
    _checkChannel,
    _logAndThrowErr
} = require('./amqp-base');
const assert = require('assert');

/**
 * The AMQP class. Allows you to connect to, listen from, and publish to an AMQP queue.
 *
 * @fires AMQP#connect - When the connection to AMQP connected.
 * @fires AMQP#message - When a message is received in the queue.
 * @fires AMQP#listen - When the instance starts listening to messages in the queue.
 * @fires AMQP#error - When something goes wrong.
 * @fires AMQP#close - When the connection to AMQP is closed.
 */
class AMQPConsumer extends AMQP {

    /**
     * Constructor of the AMQP listener.
     *
     * @param { object } options - Options object.
     * @param { function } options.logger - A `bunyan` logger instance.
     * @param { string } options.serviceName - The name of the service consuming from AMQP.
     * @param { string } options.host - The AMQP host to connect to.
     * @param { string } options.username - The AMQP username.
     * @param { string } options.password - The AMQP password.
     * @param { object } options.retry - Retry settings.
     * @param { number } options.retry.maxTries - Amount of retries.
     * @param { number } options.retry.interval - Interval between retries.
     * @param { number } options.retry.backoff - Backoff factor.
     * @param { boolean } options.durable - Whether to use durable queues or not.
     * @param { boolean } options.ackMsgs - Whether messages should be acknowledged.
     * @param { string } options.deadLetterExchange - Name of the dead letter exchange. If not provided, no DLQ is used.
     * @param { number } options.prefetch - The `prefetch` given is the maximum number of messages sent over the channel
     *                                         that can be awaiting acknowledgement
     * @param { number } options.isDeadLetterConsumer - Will skip deadletterExchange assert.
     */
    constructor(
        {
            serviceName, host, username, password, logger, retry,
            queue, exchange, exchangeType = 'topic', route, durable = false,
            ackMsgs = false, deadLetterExchange, prefetch = 0, isDeadLetterConsumer = false
        }) {
        super({
            serviceName, host, username, password, logger, retry,
            queue, exchange, exchangeType, route, durable,
            ackMsgs, deadLetterExchange, prefetch
        });
        // Validate constructor arguments
        assert.ok(queue, 'No queue passed to AMQP consumer');
        if (isDeadLetterConsumer) {
            this.deadLetterExchange = undefined;
        } else {
            assert.ok(deadLetterExchange, 'No dead letter exchange passed to AMQP consumer');
        }

        this.on('reconnect', () => {
            this.listen();
        });
    }

    /**
     * Acknowledges any message which has been received but not yet acknowledged.
     *  Only use this if acknowledgement is turned on at the broker level,
     *  otherwise it will destroy the channel. If the channel is destroyed, it will
     *  issue a `disconnect` event and recreate the connection.
     *
     * @param { object } data - This is the *exact* object emitted when a message is received
     *
     * @throws May throw an error (when acknowledging before a message
     *  is received or after an un-acknowledgable message)
     * @returns { Promise }
     */
    async acknowledgeMessage(data) {
        try {
            this._channel.ack(data);
        } catch (err) {
            this.logger.error({ err }, 'failed to ack message');
        }

        return _checkChannel(this, this._channel)
            .catch(err => {
                this.logger.error(
                    { err },
                    'Incorrectly acknowledged message, channel destroyed...'
                );
                this.emit('disconnect');
            });
    }

    /**
     *
     *
     * @param { object } data - This is the *exact* object emitted when a message is received
     * @param { boolean } requeue - whether to requeue the message (in the original queue) after nack'ing it
     *
     * @throws May throw an error (if you acknowledge before a message is received
     *  or after an un-acknowledgable message)
     * @returns { Promise }
     */
    async rejectMessage(data, requeue = false) {
        const allUpTo = false;
        try {
            await this._channel.nack(data, allUpTo, requeue);
        } catch (err) {
            this.logger.error({ err }, 'failed to nack message');
        }

        return _checkChannel(this, this._channel)
            .catch(err => {
                this.logger.error(
                    { err },
                    'Incorrectly nacked message, channel destroyed... recreating channel'
                );
                this.emit('disconnect');
            });
    }

    /**
     * Assert the queue and, if a exchange is defined, bind the queue
     * to the exchange
     *
     * @returns { Promise } if the queue and exchange definitions are correct
     */
    async assertQueue() {
        const channel = await _getChannel(this)
            .catch(_logAndThrowErr('Failed to fetch channel to assert queue', this.logger));

        const config = {
            durable: this.durable,
            deadLetterExchange: this.deadLetterExchange || undefined
        };
        await channel.assertQueue(this.queue, config)
            .catch(_logAndThrowErr('Failed to assert queue because no channel available', this.logger));

        if (this.deadLetterExchange) {
            const deadLetterQueue = `${this.deadLetterExchange}.queue`;
            await channel.assertExchange(this.deadLetterExchange, 'topic')
                .catch(_logAndThrowErr('Failed to assert dead letter exchange', this.logger));
            await channel.assertQueue(deadLetterQueue, { durable: this.durable })
                .catch(_logAndThrowErr('Failed to assert dead letter queue', this.logger));
            await channel.bindQueue(deadLetterQueue, this.deadLetterExchange, '#')
                .catch(_logAndThrowErr('Failed to bind dead letter exchange to dead letter queue', this.logger));
        }

        if (this.exchange) {
            await channel.assertExchange(this.exchange, this.exchangeType, config)
                .catch(_logAndThrowErr('Failed to assert exchange', this.logger));
            await channel.bindQueue(this.queue, this.exchange, this.route)
                .catch(_logAndThrowErr('Failed to bind exchange to queue', this.logger));
        }
    }

    /**
     * Listen to a queue.
     *
     * @returns { Promise } A promise to the response of the function Channel#consume.
     */
    async listen() {
        const queueLogger = this.logger.child({
            queue: this.queue,
            exchange: this.exchange,
            exchangeType: this.exchangeType,
            route: this.route
        });
        queueLogger.debug('Trying to listen to a queue...');

        const options = {
            // broker expects 'noAck' value
            //  so we flip our internal boolean
            noAck: !this.ackMsgs,
            consumerTag: this.serviceName
        };

        const channel = await _getConnection(this)
            .then(connection => {
                if (!connection) {
                    _logAndThrowErr(
                        'Failed to get channel while listening',
                        queueLogger)(new Error('Could not get a connection'));
                }
                return _getChannel(this);
            })
            .catch(_logAndThrowErr('Failed to get channel while listening', queueLogger));
        await this.assertQueue()
            .catch(_logAndThrowErr('Failed to get channel while listening', queueLogger));
        channel.prefetch(this.prefetch);
        return channel
            .consume(this.queue, _getChannelConsumer(this, queueLogger), options)
            .then(consumed => {
                queueLogger.info('Listening to messages');
                /**
                 * Event fired when the instance starts listening to messages in the queue.
                 *
                 * @event AMQP#listen
                 */
                this.emit('listen');

                return consumed;
            })
            .catch(err => {
                queueLogger.error({ err }, 'Failed to listen to queue');
                /**
                 * Event fired when an error occurs.
                 *
                 * @event AMQP#error
                 * @type { object }
                 */
                this.emit('error', err);
            });
    }
}

module.exports = AMQPConsumer;
