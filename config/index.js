'use strict';

const convict = require('convict');

const config = convict({
    log: {
        name: process.env.LOG_NAME,
        level: process.env.LOG_LEVEL
    },
    amqp: {
        host: process.env.AMQP_HOST,
        username: process.env.AMQP_USERNAME,
        password: process.env.AMQP_PASSWORD,
        retry: {
            maxTries: process.env.AMQP_RETRY_MAX_TRIES || 10,
            interval: process.env.AMQP_RETRY_INTERVAL || 1000,
            backoff: process.env.AMQP_RETRY_BACKOFF || 2
        }
    }
});

config.validate();
module.exports = config;
