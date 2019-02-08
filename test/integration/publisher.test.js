'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');



describe('Publishing to an exchange', () => {

    let options = Object.assign(queueOptions(config), { instanceId: 'A' });
    const producer = new AMQPPublisher(options);

    let consumer;
    let counter = 1;
    beforeEach(() => {
        ++counter;
        consumer = new AMQPConsumer(Object.assign(queueOptions(config), { instanceId: counter }));
    });

    afterEach(() => {
        if (consumer) {
            consumer.removeAllListeners();
            consumer.stop();
        }
    });

    it('Publishes a message to an exchange', async function () {
        this.timeout(1000);
        const msg = 'hello world';

        await new Promise(async (resolve) => {
            await consumer.listen();
            consumer.removeAllListeners();

            consumer.on('message', function meHere(message) {
                expect(message).to.be.eql(msg);
                consumer.removeAllListeners();
                resolve();
            });
            await producer.publish(msg);
        });

    });

    it('Publishes a lot of messages', async function () {
        this.timeout(10000);
        const amount = 10;

        await new Promise(async (resolve) => {
            await consumer.listen();
            for (let i = 0; i <= amount; i++) {
                await producer.publish(`#${i}`);
            }
            consumer.on('message', message => {
                expect(message).to.be.a('string');
                if (message === `#${amount}`) {
                    consumer.removeAllListeners();
                    resolve();
                }
            });
        });
    });

    it('Handles errors when publishing a message', async function () {
        const AMQPPublisher = rewire('../../lib/amqp-publisher');
        AMQPPublisher.__set__('_getChannel', () => {
            return Promise.reject(new Error('no channel here my pretties'));
        });

        const producer = new AMQPPublisher(queueOptions(config));

        await new Promise(async (resolve) => {
            producer.once('error', err => {
                expect(err).to.exist;
                resolve();
            });
            producer.publish('we expect this to break');
        });
    });
});
