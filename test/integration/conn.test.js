'use strict';

const { expect } = require('chai');
const uuid = require('uuid');
const rewire = require('rewire');
const { AMQPConsumer } = rewire('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');


describe('Starting up and shutting down the queue', () => {

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

describe('Handles AMQP disconnects', () => {

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
            .then(() => {
                queue.once('reconnect', () => {
                    done();
                });

                queue._getConnection()
                    .then(connection => {
                        connection.emit('close', new Error());
                    });
            })
            .catch(err => done(err));
    });
});