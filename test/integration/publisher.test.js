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

    it('Publishes a message to an exchange', async function (done) {
        this.timeout(10000);

        const msg = 'hello world';
        await consumer.listen();
        consumer.once('message', message => {
            expect(message).to.be.eql(msg);
            done();
        });
        await producer.publish(msg);
    });

    it('Publishes a lot of messages', async function (done) {
        this.timeout(10000);

        const amount = 1000;
        await consumer.listen();
        consumer.on('message', message => {
            expect(message).to.be.a('string');
            if (message === `#${amount}`) {
                consumer.removeAllListeners();
                done();
            }
        });

        for (let i = 0; i <= amount; i++) {
            await producer.publish(`#${i}`);
        }
    });

    it('Handles errors when publishing a message', function (done) {
        // sandbox.stub(producer, 'getChannel').rejects();
        const resolve = AMQP.__set__('_getChannel', () => {
            console.log('triggered');
            return Promise.reject(new Error('no channel here my pretties'));
        });
        producer.once('error', err => {
            expect(err).to.exist;
            resolve();
            done();
        });
        producer.publish('we expect this to break');
    });
});
