'use strict';
const logger = require('./mock-logger');
const config = require('../config');

module.exports = function queueOptions(input = 'test-name') {
    const queue = input+'.queue';
    const exchange = input+'.exchange';

    return {
        // serviceName: `amqp-${new Date().toISOString()}`,
        host: config.get('amqp.host'),
        username: config.get('amqp.username'),
        password: config.get('amqp.password'),
        retry: config.get('amqp.retry'),
        exchangeType: config.get('amqp.exchangeType'),
        route: config.get('amqp.route'),
        queue,
        exchange,
        logger
    };
};
