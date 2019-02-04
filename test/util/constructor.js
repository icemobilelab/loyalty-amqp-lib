'use strict';
const logger = require('./mock-logger');

module.exports = function queueOptions(config) {
    return {
        // serviceName: `amqp-${new Date().toISOString()}`,
        host: config.get('amqp.host'),
        username: config.get('amqp.username'),
        password: config.get('amqp.password'),
        retry: config.get('amqp.retry'),
        logger
    };
};
