'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = rewire('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');


describe('Publishing to an exchange', () => {

    const producer = new AMQPPublisher( queueOptions(config) );
    const consumer = new AMQPConsumer( queueOptions(config) );

    it('Publishes a message to an exchange', async function (done) {
        this.timeout(10000);

        const msg = 'hello world';
        await consumer.start();
        await producer.start();
        consumer.once('message', message => {
            expect(message).to.be.eql(msg);
            done();
        });
        await producer.publish(msg);
    });

    it('Publishes a lot of messages', async function (done) {
        this.timeout(10000);

        const amount = 1000;
        await consumer.start();
        consumer.on('message', message => {
            expect(message).to.be.a('string');
            if (message === `#${amount}`) {
                consumer.removeAllListeners();
                done();
            }
        });

        await producer.start();
        for (let i = 0; i <= amount; i++) {
            await producer.publish(`#${i}`);
        }
    });

    it('Handles errors when publishing a message', function (done) {
        sandbox.stub(producer, 'getChannel').rejects();
        producer.once('error', err => {
            expect(err).to.exist;
            done();
        });
        producer.publish('we expect this to break');
    });
});
