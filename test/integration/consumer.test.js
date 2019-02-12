'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const AMQP = rewire('../../lib/amqp-base');
const queueOptions = require('../util/constructor');

describe('Listening to a queue', () => {

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
            setTimeout(() => { consumer.stop(); done(); }, 200);

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
            const channel = await _getChannel(consumer);
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



});
