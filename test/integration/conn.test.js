'use strict';

const { expect } = require('chai');
const Bluebird = require('bluebird');
const { AMQPConsumer } = require('../../index');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
const queueOptions = require('../util/constructor');

describe('Handle connecting & disconnecting', () => {

    describe('Starting up the queue', () => {

        it('Retries connection to the AMQP server with maxTries', function (done) {
            this.timeout(50000);
            let queue = new AMQPConsumer(queueOptions('maxTries'));

            const maxTries = 1;
            let options = queueOptions('maxTries');
            options.host = 'nowhere';
            options.retry.maxTries = maxTries;
            options.retry.interval = 2;
            queue = new AMQPConsumer(options);

            let count = 0;
            const resolve = AMQP.__set__('amqp.connect', () => {
                count++;
                let err = new Error('ENOTFOUND');
                err.code = 'ENOTFOUND';
                // bluebird-retry requires bluebird promises
                return Bluebird.reject(err);
            });

            queue.listen()
                .catch(err => {
                    expect(err.code, 'Should thrown ENOTFOUND error').to.eql('ENOTFOUND');
                    expect(count, `Should retry connection ${maxTries} times`).to.eql(maxTries);
                    resolve();
                    done();
                });
        });

        it('Retries connection to the AMQP server indefinitely', function (done) {
            this.timeout(4000);
            let queue = new AMQPConsumer(queueOptions('retryIndefinitely'));

            const maxTries = -1;
            let options = queueOptions('retryIndefinitely');
            options.host = 'nowhere';
            options.retry.maxTries = maxTries;
            options.retry.interval = 2;
            queue = new AMQPConsumer(options);

            const resolve = AMQP.__set__('amqp.connect', () => {
                let err = new Error('ENOTFOUND');
                err.code = 'ENOTFOUND';
                // bluebird-retry requires bluebird promises
                return Bluebird.reject(err);
            });

            queue.listen()
                .catch(done);

            setTimeout(() => {
                resolve();
                done();
            }, 1500);
        });
    });

    describe('Shutting down the queue', () => {
        let queue = new AMQPConsumer(queueOptions('shutDown'));

        it('Closes an open connection to AMQP', function (done) {
            queue.once('close', () => {
                expect(queue._connection).to.be.undefined;
                done();
            });
            queue.listen()
                .then(() => {
                    queue.stop();
                });
        });
    });

    describe.only('Handles AMQP disconnects', () => {
        // Use rewire to get un-exported function
        const _getConnection = AMQP.__get__('_getConnection');
        const { _getChannel } = require('../../lib/amqp-base');

        let queue = new AMQPConsumer(queueOptions('handlesDisconnects'));
        beforeEach(() => {
            queue = new AMQPConsumer(queueOptions('handlesDisconnects'));
        });

        afterEach(() => {
            // when a channel is closing, it takes some time before it has
            // actually been closed, calling .stop() on a queue will try
            // and close the already closing channel, this timeout prevents that.
            // channel.close() does return a promise, but it resolves before
            // the channel has actually been closed(!)
            setTimeout(() => { queue.stop(); }, 200);
        });

        it('Reconnects on Channel close event', function (done) {
            this.timeout(5000);

            queue.once('reconnect', () => {
                done();
            });
            queue.listen()
                .then(() => {
                    _getChannel(queue)
                        .then((channel) => {
                            channel.close();
                        });
                });
        });

        it('Reconnects on Connection close event', function (done) {
            this.timeout(5000);

            queue.once('reconnect', () => {
                done();
            });
            queue.listen()
                .then(() => {
                    _getConnection(queue, false)
                        .then(conn => {
                            conn.emit('close', new Error());
                        });
                });
        });

        it('Listens again on Channel close event', function (done) {
            this.timeout(5000);

            queue.once('reconnect', () => {
                queue.once('listen', () => {
                    queue.stop()
                        .then(done);
                });
            });
            queue.listen()
                .then(() => {
                    _getChannel(queue)
                        .then(channel => {
                            channel.close();
                        });
                });
        });

        it('Listens again on Connection close event', function (done) {
            this.timeout(5000);

            // Use rewire to get un-exported function
            const _getConnection = AMQP.__get__('_getConnection');
            queue.once('reconnect', () => {
                queue.once('listen', () => {
                    queue.stop()
                        .then(done);
                });
            });
            queue.listen()
                .then(() => {
                    _getConnection(queue, false)
                        .then(conn => {
                            conn.emit('close', new Error());
                        });
                });
        });
    });
});
