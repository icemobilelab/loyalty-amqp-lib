'use strict';

const { expect } = require('chai');
const Bluebird = require('bluebird');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
const config = require('../config');
const queueOptions = require('../util/constructor');


let counter = 0;
function getOptions(serviceName = `consumer-tag-${++counter}`) {
    return {
        ...queueOptions(serviceName),
        serviceName
    };
}

describe.only('(re)connects with consumer tag', () => {

    describe('Starting up the queue and listening', () => {

        let consumer;
        after(() => {
            consumer.removeAllListeners();
            consumer.stop();
        });

        it('Connects to the broker with consumer tag', async function () {
            this.timeout(10000);
            consumer = new AMQPConsumer(getOptions('ctag-listener'));

            return await new Promise(async (resolve) => {
                consumer.once('listen', resolve);
                consumer.listen();
            });
        });

        it('Listens to message events', async function () {
            this.timeout(10000);
            const message = 'hello world';
            const options = getOptions('ctag-publisher');
            const producer = new AMQPPublisher(options);
            consumer = new AMQPConsumer(options);
            after(() => {
                producer.stop();
            });

            return await new Promise(async (resolve) => {
                consumer.once('message', msg => {
                    expect(message).to.be.eql(msg);
                    resolve();
                });
                await consumer.listen();
                await producer.publish(message);
            });
        });
    });

    // @TODO: everything below is just copy/paste
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
