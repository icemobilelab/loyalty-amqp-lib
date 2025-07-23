import { _getChannel, _getConnection, AMQP } from './amqp-base.js';

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
   * @param { boolean } options.durable - Whether to use durable exchanges or not.
   * @param { string } options.exchangeType - Exchange type (topic/fanout/direct/headers)
   */
  constructor({
    serviceName,
    host,
    username,
    password,
    queue,
    logger,
    retry,
    exchange,
    route,
    durable = false,
    exchangeType = 'topic',
  }) {
    super({
      serviceName,
      host,
      username,
      password,
      queue,
      logger,
      retry,
      exchange,
      route,
      durable,
      exchangeType,
    });
  }

  /**
   * Assert a valid exchange declaration that corresponds to the
   * server definition (if exchange exists previously)
   */
  async assertExchange() {
    const channel = await _getChannel(this);
    const config = {
      durable: this.durable,
    };
    return channel.assertExchange(this.exchange, this.exchangeType, config);
  }

  /**
   * Publish a message in the exchange.
   *
   * @param { string } message - The message to publish.
   * @param { object } headers - The headers to attach to the message.
   *
   * @returns { Promise } A promise to the response of the function Channel#publish
   */
  async publish(message, headers = {}) {
    const publishLogger = this.logger.child({
      exchange: this.exchange,
      route: this.route,
    });
    const options = {
      persistent: true,
      consumerTag: this.serviceName,
      headers,
    };

    return _getConnection(this)
      .then(() => _getChannel(this))
      .then(async (channel) => {
        await this.assertExchange();
        return channel;
      })
      .then((channel) => {
        publishLogger.trace('Publishing message');
        return channel.publish(this.exchange, this.route, Buffer.from(message), options);
      })
      .catch((err) => {
        publishLogger.error({ err }, 'Something went wrong');
        this.emit('error', err);
      });
  }

  /**
   * Publish a message to a queue.
   *
   * @param { string } message - The message to publish.
   * @param { object } headers - The headers to attach to the message.
   *
   * @returns { Promise } A promise to the response of the function Channel#publish
   */
  async publishToQueue(message, headers = {}) {
    const publishLogger = this.logger.child({
      queue: this.queue,
    });

    const options = {
      persistent: true,
      consumerTag: this.serviceName,
      headers,
    };

    return _getConnection(this)
      .then(() => _getChannel(this))
      .then((channel) => {
        publishLogger.trace('Publishing message');
        return channel.sendToQueue(this.queue, Buffer.from(message), options);
      })
      .catch((err) => {
        publishLogger.error({ err }, 'Something went wrong');
        this.emit('error', err);
      });
  }
}

export default AMQPPublisher;
