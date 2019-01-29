'use strict';

const convict = require('convict');

process.env.BLUEBIRD_DEBUG = 1;

const config = convict({
    amqp: {
        host: {
            doc: 'The host of the RabbitMQ service.',
            format: String,
            default: 'localhost',
            env: 'AMQP_HOST'
        },
        username: {
            doc: 'A RabbitMQ username.',
            format: String,
            default: 'commons',
            env: 'AMQP_USERNAME'
        },
        password: {
            doc: 'Password for the RabbitMQ user.',
            format: String,
            default: 'commons',
            env: 'AMQP_PASSWORD'
        },
        retry: {
            maxTries: {
                doc: 'Maximum amount of times we will try to (re)connect to AMQP.',
                format: 'int',
                default: 5,
                env: 'AMQP_RETRY_MAX_TRIES'
            },
            interval: {
                doc: 'Initial wait time between attempts in milliseconds.',
                format: 'int',
                default: 100,
                env: 'AMQP_RETRY_INTERVAL'
            },
            backoff: {
                doc: 'Increase interval by this factor between attempts.',
                format: 'int',
                default: 2,
                env: 'AMQP_RETRY_BACKOFF'
            }
        }
    }

});

module.exports = config;
