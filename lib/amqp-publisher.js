'use strict';
const { AMQP, _getChannel } = require('./amqp-base');

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
     * @param { string } options.serviceName - The name of the service publishing to AMQP.
     * @param { string } options.host - The AMQP host to connect to.
     * @param { string } options.username - The AMQP username.
     * @param { string } options.password - The AMQP password.
     * @param { function } options.logger - A `bunyan` logger instance.
     * @param { object } options.retry - Retry settings.
     * @param { number } options.retry.maxTries - Amount of retries.
     * @param { number } options.retry.interval - Interval between retries.
     * @param { number } options.retry.backoff - Backoff factor.
     * @param { boolean } options.durable - Whether to use durable exchanges or not.
     * @param { string } options.exchangeType - Exchange type (topic/fanout/direct/headers)
     */
    constructor({
        serviceName, host, username, password,
        logger, retry, exchange, route,
        durable = false, exchangeType = 'topic'
    }) {
        super({
            serviceName, host, username, password,
            logger, retry, exchange, route,
            durable, exchangeType
        });
    }

    /**
     * Assert a valid exchange declaration that corresponds to the
     * server definition (if exchange exist previously)
     */
    async assertExchange() {
        const channel = await _getChannel(this);
        const config = {
            durable: this.durable
        };
        return channel.assertExchange(this.exchange, this.exchangeType, config);
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
        const options = {
            persistent: true,
            consumerTag: this.serviceName
        };

        return _getChannel(this)
            .then(async (channel) => {
                await this.assertExchange(channel, exchange);
                return channel;
            })
            .then(channel => {
                publishLogger.trace('Publishing message');
                return channel.publish(exchange, route, Buffer.from(message), options);
            })
            .catch(err => {
                publishLogger.error({ err }, 'Something went wrong');
                this.emit('error', err);
            });
    }

}

module.exports = AMQPPublisher;
