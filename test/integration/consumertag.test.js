'use strict';

const { expect } = require('chai');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
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
    let producer;
    after((done) => {
        setTimeout(() => {
            if (consumer) {
                consumer.removeAllListeners();
                consumer.stop();
            }
            done();
        }, 200);
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
            this.timeout(10000);;
            const message = 'hello world';
            const options = getOptions('ctag-publisher');
            const AMQPPublisher = rewire('../../lib/amqp-publisher');
            producer = new AMQPPublisher(options);
            consumer = new AMQPConsumer(options);

            return await new Promise(async (resolve) => {
                consumer.once('message', msg => {
                    expect(message).to.be.eql(msg);
                    consumer.stop();
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
            consumer = new AMQPConsumer(options);
            const producer = new AMQPPublisher(options);
            const message = 'Test message';

            consumer.once('reconnect', () => {
                consumer.once('listen', () => {
                    producer.publish(message);
                    consumer.once('message', msg => {
                        expect(message, 'Received the wrong message').to.eql(msg);
                        consumer.stop();
                        producer.stop();
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

    describe('Subscribing to multiple queues with the same consumer tag', () => {

        it('Connects to multiple queues with same consumer tag', async function () {
            this.timeout(10000);

            let options = getOptions('ctag-multi-listener');
            options.serviceName = 'ctag-busy-service';
            const nrConsumers = 3;
            const consumers = [...Array(nrConsumers)].map(() => new AMQPConsumer(options));
            let count = 0;


            return await new Promise(async (resolve) => {
                function resolver(resolve) {
                    if (++count === nrConsumers) {
                        resolve();
                        consumers.forEach(consumer => {
                            consumer.stop();
                        });
                    }
                }

                for (let consumer of consumers) {
                    consumer.once('listen', resolver.bind(this, resolve));
                    consumer.listen();
                }
            });
        });
    });
});
