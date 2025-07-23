import logger from './mock-logger.js';
import config from '../config.js';

export default function queueOptions(input = 'test-name') {
  const queue = `${input}.queue`;
  const exchange = `${input}.exchange`;

  return {
    serviceName: `${input}`,
    host: config.get('amqp.host'),
    username: config.get('amqp.username'),
    password: config.get('amqp.password'),
    retry: config.get('amqp.retry'),
    exchangeType: config.get('amqp.exchangeType') || 'topic',
    route: config.get('amqp.route') || '#',
    deadLetterExchange: `${input}.dl`,
    queue,
    exchange,
    durable: true,
    logger,
  };
}
