'use strict';

const convict = require('convict');

process.env.BLUEBIRD_DEBUG = 1;

const config = convict({
    log: {
        name: {
            doc: 'Log name',
            format: String,
            default: 'AMQP-lib-test',
            env: 'LOG_NAME'
        },
        level: {
            doc: 'Log level',
            format: String,
            default: 'trace',
            env: 'LOG_LEVEL'
        }
    },
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
    },
    sonarqube: {
        serverUrl: {
            doc: 'The SonarQube Host',
            format: 'url',
            default: 'https://sonarcloud.io',
            env: 'SONARQUBE_HOST'
        },
        token: {
            doc: 'The SonarQube Token',
            format: String,
            default: '3e54ded412f11c98480daf42fe7dfc913fcb7357',
            env: 'SONARQUBE_TOKEN'
        },
        projectKey: {
            doc: 'The SonarQube Project Key',
            format: String,
            default: 'loyalty-amqp-lib',
            env: 'SONARQUBE_PROJECT_KEY'
        },
        projectVersion: {
            doc: 'The SonarQube Project Version',
            format: String,
            default: '0.0.0',
            env: 'SONARQUBE_PROJECT_VERSION'
        },
    }
});

module.exports = config;
