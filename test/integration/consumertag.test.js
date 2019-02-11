'use strict';

const { expect } = require('chai');
const Bluebird = require('bluebird');
const { AMQPConsumer } = require('../../index');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
const config = require('../config');
const queueOptions = require('../util/constructor');


describe('(re)connects with consumer tag', () => {

    describe('Starting up the queue', () => {

        let options = queueOptions(config);

        let _getChannel = AMQP.__get__('_getChannel');
        let consumer = new AMQPConsumer(options);
        const producer = new AMQPPublisher(options);

        after(() => {
            consumer.removeAllListeners();
            consumer.stop();
        });

        // if moved to bottom, will fail, some shared state
        // can mess these up(!)
        it('Listens to message events', async function () {
            this.timeout(10000);
            const message = 'hello world';

            return await new Promise(async (resolve) => {
                await consumer.listen();
                consumer.once('message', msg => {
                    expect(message).to.be.eql(msg);
                    resolve();
                });
                await producer.publish(message);
            });
        });
    });

    describe('Shutting down the queue', () => {
        let queue = new AMQPConsumer(queueOptions(config));

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

    describe('Handles AMQP disconnects', () => {
        // Use rewire to get un-exported function
        const _getConnection = AMQP.__get__('_getConnection');
        const { _getChannel } = require('../../lib/amqp-base');

        let queue = new AMQPConsumer(queueOptions(config));
        beforeEach(() => {
            queue = new AMQPConsumer(queueOptions(config));
        });

        it('Reconnects on Channel close event', function (done) {
            queue.once('reconnect', done);
            queue.listen()
                .then(() => {
                    _getChannel(queue)
                        .then(channel => {
                            channel.close();
                        });
                });
        });

        it('Reconnects on Connection close event', function (done) {

            let queue = new AMQPConsumer(queueOptions(config));

            this.timeout(50000);
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
            queue.once('reconnect', () => {
                queue.once('listen', done);
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
                queue.once('listen', done);
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
