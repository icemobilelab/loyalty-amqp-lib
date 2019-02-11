'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = rewire('../../index');
const AMQP = rewire('../../lib/amqp-base');
const queueOptions = require('../util/constructor');

describe('Dead letter queue', () => {

    let _getChannel = AMQP.__get__('_getChannel');
    let consumer, producer, config;
    let testNum = 0;

    beforeEach(() => {
        config = queueOptions(`${++testNum}-deadletter`);
        consumer = new AMQPConsumer(config);
        producer = new AMQPPublisher(config);
    });

    afterEach(() => {
        if (consumer) {
            consumer.removeAllListeners();
            consumer.stop();
        }
    });


    it('Sends nonacknowledged messages to the dead letter queue', async function () {
        this.timeout(0);

        // have queue publish to listener. listener nacks -> msg goes to dlq
        await new Promise(async (resolve) => {

            const dlq = new AMQPConsumer({ ...config, ...{ queue: 'dlq' } });
            await dlq.listen();
            await consumer.listen();

            const msg = 'Dead pigeon';

            consumer.on('message', async (messageString, data) => {
                const channel = await _getChannel(consumer);
                channel.nack(data, false, false);
            });

            dlq.on('message', (messageString) => {
                expect(messageString).to.be.a('string').and.eql(msg);
                dlq.stop();
                resolve();
            });

            producer.publish(msg);
        });



    });
});
