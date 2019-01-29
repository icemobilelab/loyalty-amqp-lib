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
