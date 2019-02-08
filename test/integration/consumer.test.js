'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const AMQP = rewire('../../lib/amqp-base');
const config = require('../config');
const queueOptions = require('../util/constructor');

describe('Listening to a queue', () => {

    let _getChannel = AMQP.__get__('_getChannel');
    let consumer = new AMQPConsumer(queueOptions(config));
    const producer = new AMQPPublisher(queueOptions(config));


    beforeEach(() => {
        consumer = new AMQPConsumer(queueOptions(config));
    });

    afterEach(() => {
        if (consumer) {
            consumer.removeAllListeners();
            consumer.stop();
        }
    });

    // if moved to bottom, will fail, some shared state
    // can mess these up(!)
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

    it('Connects and listens to a queue', async function () {
        await new Promise(async (resolve) => {
            consumer.once('listen', () => {
                resolve();
            });
            await consumer.listen();
        });

    });

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



});
