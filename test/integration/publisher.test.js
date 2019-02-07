'use strict';

const { expect } = require('chai');
const { AMQPConsumer, AMQPPublisher } = require('../../index');
const rewire = require('rewire');
const AMQP = rewire('../../lib/amqp-base');
const config = require('../config');
const queueOptions = require('../util/constructor');


describe('Publishing to an exchange', () => {

    const producer = new AMQPPublisher(queueOptions(config));
    const consumer = new AMQPConsumer(queueOptions(config));

    it('Publishes a message to an exchange', async function () {
        this.timeout(10000);
        const message = 'hello world';

        await new Promise(async (resolve) => {
            await consumer.listen();
            consumer.once('message', message => {
                expect(message).to.be.eql(message);
                resolve();
            });
            await producer.publish(message);
        });

    });

    it('Publishes a lot of messages', async function () {
        this.timeout(10000);
        const amount = 1000;

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

    // it.only('Handles errors when publishing a message', async function () {

    //     const { AMQPPublisher } = rewire('../../index');
    //     const producer = new AMQPPublisher(queueOptions(config));

    //     AMQP.__set__('_getChannel', () => {
    //         return Promise.reject(new Error('no channel here my pretties'));
    //     });

    //     await new Promise(async (resolve) => {
    //         producer.once('error', err => {
    //             console.log('ERROR', err);
    //             expect(err).to.exist;
    //             resolve();
    //         });
    //         producer.publish('we expect this to break');
    //     });
    // });
});
