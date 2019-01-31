'use strict';
const AMQP = require('./amqp-base');
const config = require('./../config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
    name: config.get('log.name'),
    level: config.get('log.level')
});

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
     * @param { string } options.serviceName - The name of the service consuming from AMQP.
     * @param { string } options.host - The AMQP host to connect to.
     * @param { string } options.username - The AMQP username.
     * @param { string } options.password - The AMQP password.
     * @param { object } options.retry - Retry settings.
     * @param { number } options.retry.maxTries - Amount of retries.
     * @param { number } options.retry.interval - Interval between retries.
     * @param { number } options.retry.backoff - Backoff factor.
     * @param { boolean } options.durable - Whether to use durable queues or not.
     * @param { boolean } options.noAck - Whether to acknowledge messages automatically.
     * @param { string } options.deadLetterExchange - Name of the dead letter exchange. If not provided, no DLQ is used.
     * @param { number } options.prefetch - The `prefetch` given is the maximum number of messages sent over the channel
*                                         that can be awaiting acknowledgement
     */
    constructor(
        {
            serviceName,
            host,
            username,
            password,
            retry,
            durable = false,
            noAck = true,
            deadLetterExchange,
            prefetch = 0
        }) {
        super({ serviceName, host, username, password, retry, durable, noAck, deadLetterExchange, prefetch, logger });

        // These will be loaded from config map
        this.queue = 'QUEUE';
        this.exchangeName = 'EXCHANGE';
        this.exchangeType = 'topic';
        this.route = 'ROUTE';
    }


    /**
     * Assert the queue and, if a exchange is defined, bind the queue
     * to the exchange
     *
     * @param { channel } channel - AMQP channel.
     * @param { string } queue - Queue name to assert.
     * @param { string } exchangeName - Optional exchange to be linked to the queue
     * @param { string } exchangeType - Type for the optional exchange
     * @param { string } route - Route definition for bind between the queue and the exchange
     *
     * @returns { boolean } if the queue and exchange definitions are correct
     */
    async assertQueue() {
        const channel = await this.getChannel();
        const queue = this.queue;
        const exchangeName = this.exchange;
        const exchangeType = this.exchangeType;
        const route = this.route;

        if (this.deadLetterExchange) {
            const deadLetterQueue = this.deadLetterExchange + '.queue';
            channel.assertExchange(this.deadLetterExchange, 'topic');
            channel.assertQueue(deadLetterQueue, { durable: this.durable });
            channel.bindQueue(deadLetterQueue, this.deadLetterExchange, '#');
        }

        const config = {
            durable: this.durable,
            deadLetterExchange: this.deadLetterExchange || undefined
        };

        if (exchangeName) {
            channel.assertExchange(exchangeName, exchangeType, config);
            channel.bindQueue(queue, exchangeName, route);
        }

        return channel.assertQueue(queue, config);
    }

    /**
     * Returns a function which processes incoming messages from the
     * channel and fires the message event with the input.
     *
     * @param { function } queueLogger - Logger
     *
     * @returns { function } function for processing incoming messages
     */
    _getChannelConsumer(queueLogger) {
        return (
            data => {
                queueLogger.trace({ fields: data.fields }, 'Received data from queue');
                const message = data.content.toString();
                queueLogger.debug('Received message from queue');
                /**
                 * Event fired when a message is received in the queue.
                 *
                 * @event AMQP#message
                 */
                this.emit('message', message, data, channel);
            }
        ).bind(this);
    }

    /**
     * Listen to a queue.
     *
     * @param { string } queue - Name of the queue to listen to.
     * @param { string } exchangeName - Name of the exchange to bind with.
     * @param { string } exchangeType - Type of the exchange to bind with.
     * @param { string } route - Route definition for bind between the queue and the exchange
     *
     * @returns { Promise } A promise to the response of the function Channel#consume.
     */
    async listen() {
        const queue = this.queue;
        const exchangeName = this.exchange;
        const exchangeType = this.exchangeType;
        const route = this.route;

        const queueLogger = this.logger.child({ queue });
        queueLogger.debug('Trying to listen to a queue...');

        const options = {
            noAck: this.noAck,
            consumerTag: this.serviceName
        };

        const channel = await this.getChannel()
            .catch(err => {
                queueLogger.error({ err }, 'Failed to get channel while listening');
                throw err;
            });
        await this.assertQueue(channel, queue, exchangeName, exchangeType, route)
            .catch(err => {
                queueLogger.error({ err }, 'Failed to assert queue existence while listening');
                throw err;
            });
        channel.prefetch(this.prefetch);
        return channel.consume(queue, this._getChannelConsumer(queueLogger), options)
            .then(consumed => {
                queueLogger.info('Listening to messages');
                /**
                 * Event fired when the instance starts listening to messages in the queue.
                 *
                 * @event AMQP#listen
                 */
                this.emit('listen');

                // When we create a new channel, we should start listening again
                this.once('channelRecreate', () => {
                    queueLogger.warn('Channel is recreated, calling listen() again');
                    this.listen(queue, exchangeName, exchangeType, route);
                });

                return consumed;
            }).catch(err => {
                queueLogger.error({ err }, 'Something went wrong');
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
