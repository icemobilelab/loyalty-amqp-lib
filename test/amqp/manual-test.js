'use strict';

/*
 * Manual test suite for the AMQP module
 *
 * Steps:
 * 1.- Run this file (node test/amqp/manua-test.js)
 * 2.- Once the process is ready and the queue is listened to, make sure to get the PID of this process
 * 3.- Restart the RabbitMQ docker service (docker restart <id>)
 * 4.- Confirm in the logs that the AMQP module eventually reconnects to the queue
 * 5.- Force the publishing of a message (kill -SIGUSR2 <PID>)
 * 6.- Confirm that the message is sent and received in the logs
 * 7.- Close the RabbitMQ connection using the RabbitMQ admin interface (localhost:15672, username/password "commons")
 * 8.- Confirm in the logs that the AMQP module eventually reconnects to the queue
 * 9.- Force the publishing of a message (kill -SIGUSR2 <PID>)
 * 10.- Confirm that the message is sent and received in the logs
 */

const _ = require('lodash');
const compose = require('docker-compose');
const { Spinner } = require('cli-spinner');

const { AMQP } = require('../../index');
const config = require('./config');

const spinner = new Spinner('Invoking docker-compose... %s');
spinner.setSpinnerString(0);
spinner.start();
compose.up({ cwd: __dirname, log: false }).then(() => {
    spinner.stop(true);

    const logger = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].reduce((accumulator, item) => {
        accumulator[item] = function(obj, message) {
            if (!message) {
                message = obj;
                if (_.isObject(message)) {
                    message = JSON.stringify(message);
                }
                console.log(`[${item}] ${message}`); // eslint-disable-line no-console
            } else {
                if (_.isObject(obj)) {
                    obj = JSON.stringify(obj);
                }
                console.log(`[${item}] ${message}: ${obj}`); // eslint-disable-line no-console
            }
        };
        accumulator.child = function() {
            return accumulator;
        };
        return accumulator;
    }, {});

    const QUEUE_NAME = 'test-queue';
    class Queue extends AMQP {

        constructor({ config, logger }) {
            super({
                host: config.get('amqp.host'),
                username: config.get('amqp.username'),
                password: config.get('amqp.password'),
                logger,
                retry: config.get('amqp.retry')
            });
        }

        publishMessage(message) {
            this.publish(QUEUE_NAME, message);
        }

        publishError(message) {
            this.publish(QUEUE_NAME, message);
        }
    }

    const queue = new Queue({ config, logger });

    queue.on('connect', () => {
        queue.listen(QUEUE_NAME);
    });
    queue.on('listen', () => {
        logger.info('Queue is listening');
    });
    queue.on('message', message => {
        logger.info(`Received message: ${message}`);
    });

    queue.start();

    process.on('SIGUSR2', () => {
        logger.info('Received SIGUSR2 signal');
        queue.publishMessage('test');
    });
});
