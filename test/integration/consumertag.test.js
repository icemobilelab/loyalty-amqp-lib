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

describe('(re)connects with consumer tag', () => {

    let consumer;
    after(() => {
        consumer.removeAllListeners();
        consumer.stop();
    });

    describe('Starting up the queue and listening', () => {

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
                producer.publish(message);
            });
        });
    });

    describe('Handles AMQP disconnects', () => {
        // Use rewire to get un-exported function
        const _getConnection = AMQP.__get__('_getConnection');
        const { _getChannel } = require('../../lib/amqp-base');

        it('Reconnects on Channel close event', function (done) {
            consumer = new AMQPConsumer(getOptions('ctag-listener'));

            consumer.once('reconnect', done);
            consumer.listen()
                .then(() => {
                    _getChannel(consumer)
                        .then(channel => {
                            // channel.close();
                            channel.emit('close', new Error());
                        });
                });
        });

        it('Reconnects on Connection close event', function (done) {
            this.timeout(50000);
            consumer = new AMQPConsumer(getOptions('ctag-reconnect-conn-close'));

            consumer.once('reconnect', () => {
                done();
            });
            consumer.listen()
                .then(() => {
                    _getConnection(consumer, false)
                        .then(conn => {
                            // conn.close();
                            conn.emit('close', new Error());
                        });
                });
        });

        it('Listens again on Channel close event', function (done) {
            this.timeout(5000);
            const options = getOptions('ctag-reconnect-publisher');
            const producer = new AMQPPublisher(options);
            consumer = new AMQPConsumer(options);
            const message = 'Test message';

            consumer.once('reconnect', () => {
                consumer.once('listen', () => {
                    console.log('\n--- listening after reconnect');
                    producer.publish(message);
                    consumer.once('message', msg => {
                        console.log('received message:', msg);
                        done();
                    });
                });
            });
            consumer.listen()
                .then(() => {
                    _getChannel(consumer)
                        .then(channel => {
                            // channel.close();
                            channel.emit('close', new Error());
                        });
                });
        });

        it('Listens again on Connection close event', function (done) {
            this.timeout(5000);
            consumer = new AMQPConsumer(getOptions('ctag-listener-conn-close'));

            consumer.once('reconnect', () => {
                consumer.once('listen', done);
            });
            consumer.listen()
                .then(() => {
                    _getConnection(consumer, false)
                        .then(conn => {
                            // conn.close();
                            conn.emit('close', new Error());
                        });
                });
        });
    });
});
