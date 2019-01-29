'use strict';

const convict = require('convict');

const config = convict({
    log: {
        name: {
            doc: 'Log name',
            format: String,
            default: 'AMQP-lib',
            env: 'LOG_NAME'
        },
        level: {
            doc: 'Log level',
            format: String,
            default: 'fatal',
            env: 'LOG_LEVEL'
        }
    },
    amqp: {
        host: {
            doc: 'AMQP Host',
            format: String,
            default: null,
            env: 'AMQP_HOST'
        },
        username: {
            doc: 'AMQP Username',
            format: String,
            default: null,
            env: 'AMQP_USER'
        },
        password: {
            doc: 'AMQP Password',
            format: String,
            default: null,
            env: 'AMQP_PASSWORD'
        },
        port: {
            doc: 'AMQP Port',
            format: 'port',
            default: 5672,
            env: 'AMQP_PORT'
        },
        retry: {
            maxTries: {
                doc: 'Number of retries',
                format: 'int',
                default: 10,
                env: 'AMQP_RETRIES'
            },
            interval: {
                doc: 'Retry interval',
                format: 'int',
                default: 1000,
                env: 'AMQP_RETRY_INTERVAL'
            },
            backoff: {
                doc: 'Retry backoff',
                format: 'int',
                default: 2,
                env: 'AMQP_RETRY_BACKOFF'
            }
        }
    }
});

config.validate();
module.exports = config;
