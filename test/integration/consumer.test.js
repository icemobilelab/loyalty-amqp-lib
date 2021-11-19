'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const AMQP = rewire('../../lib/amqp-base');
const queueOptions = require('../util/constructor');

describe('Consumer Integration Tests', () => {
    describe('Listening to a queue', () => {

        let _connect = AMQP.__get__('_connect');
        let _getChannel = AMQP.__get__('_getChannel');
        let consumer, producer, config;
        let testNum = 0;

        beforeEach(() => {
            config = queueOptions(`consumer-${++testNum}`);
            consumer = new AMQPConsumer(config);
            producer = new AMQPPublisher(config);
        });

        afterEach((done) => {
            if (consumer) {
                consumer.removeAllListeners();
                setTimeout(() => { consumer.stop(); done(); }, 500);
            }
        });

        it('Connects and listens to a queue', async function () {
            await new Promise(async (resolve) => {
                consumer.once('listen', () => {
                    resolve();
                });
                await consumer.listen();
            });

        });

        // the amqplib will throw one unhandled rejection error when
        // running this test, due to the reconnection logic.
        it('Handles errors when listening to a queue', async function () {

            await new Promise(async (resolve) => {
                await _connect(consumer);
                const channel = await _getChannel(consumer, false);
                consumer.once('reconnect', () => {
                    resolve();
                });
                await consumer.listen();
                await channel.close();
            });

        });

        it('Listens to message events', async function () {

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


        it('Acknowledging a message ', async function () {

            const message = 'hello world';

            return await new Promise(async (resolve) => {
                await consumer.listen();
                consumer.once('message', async (msg, data) => {
                    expect(message).to.be.eql(msg);
                    consumer.acknowledgeMessage(data);
                    resolve();
                });
                await producer.publish(message);
            });

        });

        it('Acknowledging an already acknowledged message ', async function () {

            const message = 'hello world';

            return await new Promise(async (resolve) => {
                await consumer.listen();
                consumer.once('disconnect', resolve);
                consumer.once('message', async (msg, data) => {
                    expect(message).to.be.eql(msg);
                    consumer.acknowledgeMessage(data);
                    consumer.acknowledgeMessage(data);

                });
                await producer.publish(message);
            });

        });
    });

    describe('(N)Acking messages', () => {

        it('Rejecting a message ', async function () {

            const message = 'hello world';

            const config = queueOptions('consumer-reject-1');
            config.noAck = false;

            const consumer = new AMQPConsumer(config);
            const producer = new AMQPPublisher(config);

            config.queue = config.deadLetterExchange;
            config.isDeadLetterConsumer = true;
            const deadLetterConsumer = new AMQPConsumer(config);

            return await new Promise(async (resolve) => {
                deadLetterConsumer.once('message', msg => {
                    expect(message).to.be.eql(msg);
                    resolve();
                });
                await deadLetterConsumer.listen();
                await consumer.listen();

                consumer.once('message', async (msg, data) => {
                    expect(message).to.be.eql(msg);
                    await consumer.rejectMessage(data);
                });
                await producer.publish(message);
            });

        });

        it('Rejecting an already rejected message ', async function () {

            const message = 'hello world';
            const config = queueOptions('consumer-reject-2');
            const consumer = new AMQPConsumer(config);
            const producer = new AMQPPublisher(config);

            return await new Promise(async (resolve) => {
                await consumer.listen();
                consumer.once('disconnect', resolve);
                consumer.once('message', async (msg, data) => {
                    expect(message).to.be.eql(msg);
                    consumer.rejectMessage(data);
                    consumer.rejectMessage(data);
                });
                await producer.publish(message);
            });

        });
    });
});
