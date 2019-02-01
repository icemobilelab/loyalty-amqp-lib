'use strict';
const AMQP = require('./amqp-base');
const config = require('./../config');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
    name: 'publisher', // config.get('log.name'),
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
        super({ host, username, password, retry, durable, type, logger });

        // Load from config map
        this.exchange = 'EXCHANGE';
        this.route = 'ROUTE';
    }

    /**
     * Assert a valid exchange declaration that corresponds to the
     * server definition (if exchange exist previously)
     */
    async assertExchange() {
        const exchange = this.exchange;
        const channel = await this.getChannel();
        const config = {
            durable: this.durable
        };
        return channel.assertExchange(exchange, this.type, config);
    }

    /**
     * Publish a message in the exchange.
     *
     * @param { string } message - The message to publish.
     *
     * @returns { Promise } A promise to the response of the function Channel#publish
     */
    async publish(message) {
        const exchange = this.exchange;
        const route = this.route;
        const publishLogger = this.logger.child({ exchange, route });

        return this.getChannel()
            .then(channel => {
                return this.assertExchange(channel, exchange)
                    .then(() => {
                        publishLogger.trace('Publishing message');
                        return channel.publish(exchange, route, Buffer.from(message), { persistent: true });
                    });
            }).catch(err => {
                publishLogger.error({ err }, 'Something went wrong');
                this.emit('error', err);
            });
    }

}

module.exports = AMQPPublisher;
