'use strict';

/* global describe, it, before, after, beforeEach, afterEach */

const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('uuid');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const config = require('../config');
const logger = require('../util/mock-logger');

describe('AMQP', () => {

    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe('Starting up and shutting down the queue', () => {

        function queueOptions(config) {
            return {
                host: config.get('amqp.host'),
                username: config.get('amqp.username'),
                password: config.get('amqp.password'),
                retry: config.get('amqp.retry'),
                logger
            };
        }
        let queue = new AMQPConsumer(queueOptions(config));
        beforeEach(() => {
            queue = new AMQPConsumer(queueOptions(config));
        });

        afterEach((done) => {
            Promise.resolve()
                .then(() => queue.stop())
                .then(() => queue.removeAllListeners())
                .then(() => done())
                .catch(err => done(err));
        });

        it('Retries connection to the AMQP server with maxTries', function (done) {
            this.timeout(30000);
            const amqpConfig = queueOptions(config);
            amqpConfig.host = uuid();

            const faultyQueue = new AMQPConsumer(amqpConfig);

            after((done) => {
                faultyQueue.stop();
                done();
            });

            let errored = false;

            faultyQueue.once('connect', () => {
                throw new Error('Should not connect');
            });

            faultyQueue.start()
                .catch((err) => {
                    errored = err;
                });

            // check that it errors out after retrying, not already after 200ms
            setTimeout(() => {
                expect(errored, 'Should not throw error before retrying ended').to.equal(false);
            }, 200);

            setTimeout(() => {
                expect(errored.code, 'Should throw ENOTFOUND error').to.equal('ENOTFOUND');
                done();
            }, (
                    config.get('amqp.retry.interval')
                    * Math.pow(
                        config.get('amqp.retry.backoff'),
                        config.get('amqp.retry.maxTries')
                    ) + 500
                )
            );
        });

        it('Retries connection indefinitely to the AMQP server without maxTries', function (done) {
            this.timeout(30000);
            const amqpConfig = queueOptions(config);
            amqpConfig.host = uuid();
            amqpConfig.retry.maxTries = undefined;
            amqpConfig.maxInterval = 5000;

            const faultyQueue = new AMQPConsumer(amqpConfig);

            after((done) => {
                faultyQueue.stop();
                done();
            });

            let errored = false;

            faultyQueue.once('connect', () => {
                throw new Error('Should not connect');
            });

            faultyQueue.start()
                .catch((err) => {
                    errored = err;
                });

            // check that it errors out after retrying, not already after 200ms
            setTimeout(() => {
                expect(errored, 'Should not throw error when trying indefinitely').to.equal(false);
            }, 200);

            setTimeout(() => {
                expect(errored, 'Should not throw error when trying indefinitely').to.equal(false);
                done();
            }, (config.get('amqp.retry.interval') * Math.pow(config.get('amqp.retry.backoff'), config.get('amqp.retry.maxTries')) + 1500)); // eslint-disable-line
        });

        it('Listens again on Channel close event', function (done) {
            this.timeout(2000);

            queue.start()
                .then(() => queue.listen(uuid()))
                .then(() => {
                    queue.once('reconnect', () => {
                        done();
                    });

                    queue.getChannel()
                        .then(channel => {
                            channel.emit('close', new Error());
                        });
                })
                .catch(err => done(err));
        });

        it('Listens again on Connection close event', function (done) {
            this.timeout(2000);

            queue.start()
                .then(() => queue.listen(uuid()))
                .then(() => {
                    queue.once('reconnect', () => {
                        done();
                    });

                    queue._getConnection()
                        .then(conn => {
                            conn.emit('close', new Error('test'));
                        });
                })
                .catch(err => done(err));
        });

        it('Triggers a reconnect event when the connection is lost', function (done) {
            this.timeout(2000);

            const thrownError = new Error('unexpected error');
            queue.start()
                .then(() => {
                    queue.once('reconnect', () => {
                        done();
                    });

                    queue._getConnection()
                        .then(connection => {
                            connection.emit('close', thrownError);
                        });
                })
                .catch(err => done(err));
        });

        it('Reconnects on Connection close event', function (done) {
            this.timeout(2000);

            const spy = sandbox.spy(queue, 'connect');
            queue.start()
                .then(() => {
                    queue.once('connect', conn => {
                        expect(spy.callCount).to.be.eql(2);
                        expect(conn).to.exist.and.be.an('object');
                        expect(queue._connection).to.exist.and.be.an('object');
                        done();
                    });

                    queue._getConnection()
                        .then(connection => {
                            connection.emit('close', new Error());
                        });
                })
                .catch(err => done(err));
        });

        it('Closes an open connection to AMQP', done => {
            queue.once('close', () => {
                expect(queue._channel).to.be.undefined;
                done();
            });
            queue.start()
                .then(() => queue.stop())
                .catch(err => done(err));
        });
    });

    describe('Listening and publishing on queue', () => {

        const QUEUE_NAME = 'test-queue';

        class Queue extends AMQPConsumer {

            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    retry: config.get('amqp.retry'),
                    logger
                });
            }

            publishMessage(message) {
                return this.publish(QUEUE_NAME, message);
            }

            publishError(message) {
                return this.publish(QUEUE_NAME, message);
            }
        }

        const queue = new Queue({ config, logger });

        after(() => {
            queue.stop();
        });

        it('Connects and listens to a queue', function (done) {
            queue.once('connect', () => {
                queue.listen(QUEUE_NAME);
            });
            queue.once('listen', done);
            queue.start();
        });

        it('Publishes a message', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('hello world');
                done();
            });
            queue.publishMessage('hello world');
        });

        it('Publishes a lot of messages', function (done) {
            this.timeout(0);
            const amount = 1000;
            queue.on('message', message => {
                expect(message).to.be.a('string');
                if (message === `#${amount}`) {
                    queue.removeAllListeners();
                    done();
                }
            });
            for (let i = 0; i <= amount; i++) {
                queue.publishMessage(`#${i}`);
            }
        });

        it('Publishes an error message', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('something went wrong');
                done();
            });
            queue.publishError('something went wrong');
        });

        it('Handles errors when listening to a queue', function (done) {
            sandbox.stub(queue, 'getChannel').rejects();
            queue.once('error', err => {
                expect(err).to.exist;
                done();
            });
            queue.listen('some-other-queue-name');
        });

        it('Handles errors when publishing a message', function (done) {
            sandbox.stub(queue, 'getChannel').rejects();
            queue.once('error', err => {
                expect(err).to.exist;
                done();
            });
            queue.publishMessage('we expect this to break');
        });
    });

    describe('Dead letter queue', () => {

        const MAIN_QUEUE_NAME = 'dlq-queue-main';
        const DLQ_QUEUE_NAME = 'dlq-queue-dlq';

        class Queue extends AMQPConsumer {

            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    retry: config.get('amqp.retry'),
                    durable: true,
                    noAck: false,
                    deadLetterExchange: DLQ_QUEUE_NAME,
                    logger
                });
            }

            start() {
                this.once('connect', () => {
                    super.listen(`${MAIN_QUEUE_NAME}`);
                });
                return super.connect();
            }

            publishMessage(message) {
                return this.publish(MAIN_QUEUE_NAME, message);
            }

            publishError(message) {
                return this.publish(MAIN_QUEUE_NAME, message);
            }
        }

        class DLQueue extends AMQPConsumer {

            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    retry: config.get('amqp.retry'),
                    durable: true,
                    logger
                });
            }

            start() {
                this.once('connect', () => {
                    super.listen(`${DLQ_QUEUE_NAME}.queue`);
                });
                return super.connect();
            }
        }

        const queue = new Queue({ config, logger });
        const dlq = new DLQueue({ config, logger });

        it('Sends dead pidgeons to the dead letter queue', function (done) {

            this.timeout(0);

            queue.on('message', (messageString, data) => {
                queue._channel.nack(data, false, false);
            });

            dlq.on('message', (messageString) => {
                expect(messageString).to.be.a('string').and.eql('Dead pidgeon');
                queue.stop();
                dlq.stop();
                done();
            });

            queue.start().then(() => {
                dlq.start().then(() => {
                    queue.publishMessage('Dead pidgeon');
                });
            });

        });
    });

    describe('Listening on queue and publishing on exchange', () => {

        const EXCHANGE_NAME = 'test-exchange';
        const EXCHANGE_TYPE = 'topic';
        const QUEUE_NAME = 'test-queue';

        class Exchange extends AMQPPublisher {
            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    logger,
                    retry: config.get('amqp.retry')
                });
            }

            publishMessage(message, route = '') {
                return this.publish(EXCHANGE_NAME, message, route);
            }
            publishError(message) {
                return this.publish(EXCHANGE_NAME, message);
            }
        }

        class Queue extends AMQPConsumer {
            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    logger,
                    retry: config.get('amqp.retry')
                });
            }
        }

        const exchange = new Exchange({ config, logger });
        const queue = new Queue({ config, logger });

        after(() => {
            exchange.stop();
            queue.stop();
        });

        it('Connects and listens to a queue (and start exchange)', function (done) {
            queue.once('connect', () => {
                queue.listen(QUEUE_NAME, EXCHANGE_NAME, EXCHANGE_TYPE);
            });
            queue.once('listen', done);
            queue.start();
            exchange.start();
        });

        it('Publishes a message to a exchange', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('hello world');
                done();
            });
            exchange.publishMessage('hello world');
        });

        it('Publishes a lot of messages', function (done) {
            this.timeout(0);
            const amount = 1000;
            queue.on('message', message => {
                expect(message).to.be.a('string');
                if (message === `#${amount}`) {
                    queue.removeAllListeners();
                    done();
                }
            });
            for (let i = 0; i <= amount; i++) {
                exchange.publishMessage(`#${i}`);
            }
        });

        it('Publishes an error message', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('something went wrong');
                done();
            });
            exchange.publishError('something went wrong');
        });

        it('Handles errors when publishing a message', function (done) {
            sandbox.stub(exchange, 'getChannel').rejects();
            exchange.once('error', err => {
                expect(err).to.exist;
                done();
            });
            exchange.publishMessage('we expect this to break');
        });
    });


    describe('Listening on queue and publishing on exchange with routes', () => {

        const EXCHANGE_NAME = 'test-exchange';
        const EXCHANGE_TYPE = 'topic';
        const QUEUE_NAME = 'test-queue';
        const ROUTE = 'test-ok';

        class Exchange extends AMQPPublisher {
            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    logger,
                    retry: config.get('amqp.retry')
                });
            }

            publishMessage(message, route = '') {
                return this.publish(EXCHANGE_NAME, message, route);
            }
            publishError(message) {
                return this.publish(EXCHANGE_NAME, message);
            }
        }

        class Queue extends AMQPConsumer {
            constructor({ config, logger }) {
                super({
                    host: config.get('amqp.host'),
                    username: config.get('amqp.username'),
                    password: config.get('amqp.password'),
                    logger,
                    retry: config.get('amqp.retry')
                });
            }
        }

        const exchange = new Exchange({ config, logger });
        const queue = new Queue({ config, logger });

        after(() => {
            exchange.stop();
            queue.stop();
        });

        it('Connects and listens to a queue to route "test-ok" (and start exchange)', function (done) {
            queue.once('connect', () => {
                queue.listen(QUEUE_NAME, EXCHANGE_NAME, EXCHANGE_TYPE, ROUTE);
            });
            queue.once('listen', done);
            queue.start();
            exchange.start();
        });

        it('Publishes a message to a exchange with route', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('hello world');
                done();
            });
            exchange.publishMessage('hello world', ROUTE);
        });

        it('Publishes 2 messages, 1 with "test-ok" route', function (done) {
            queue.on('message', message => {
                expect(message).to.be.eql('hello world');
                done();
            });
            exchange.publishMessage('bye world', 'wrong-route');
            exchange.publishMessage('hello world', ROUTE);
        });

    });


    describe('Promises', () => {

        const QUEUE_NAME = 'promises-queue';

        class Queue extends AMQPConsumer {

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
                return this.publish(QUEUE_NAME, message);
            }

            publishError(message) {
                return this.publish(QUEUE_NAME, message);
            }
        }

        const queue = new Queue({ config, logger });

        it('Can start and stop with promises', function (done) {
            queue.start()
                .then(data => {
                    expect(data).to.be.an('object');
                    return queue.listen(QUEUE_NAME);
                }).then(data => {
                    expect(data).to.be.an('object');
                    expect(data).to.have.keys('consumerTag');
                    return queue.stop().then(done);
                });
        });
    });

    describe('Abstract methods', () => {

        const queue = new AMQPConsumer({ config, logger });

        it('Throws an exception on abstract methods', done => {
            expect(queue.publishMessage).to.throw();
            expect(queue.publishError).to.throw();
            done();
        });
    });
});
