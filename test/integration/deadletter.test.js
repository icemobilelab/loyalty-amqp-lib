'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer, AMQPPublisher } = rewire('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');

describe('Dead letter queue', () => {

    let queue;
    let dlq;
    beforeEach(() => {
        queue = new AMQPPublisher(queueOptions(config));
        dlq = new AMQPConsumer(queueOptions(config));

        // have queue publish to listener. listener nacks -> msg goes to dlq
        // queue.__set__('')
        // rewire dlq so internal deadletter points to dlq
        dlq.__set__('exchange', 'dlq');
    });

    it('Sends nonacknowledged messages to the dead letter queue', function (done) {
        this.timeout(0);

        const msg = 'Dead pigeon';
        queue.on('message', (messageString, data) => {
            queue._channel.nack(data, false, false);
        });

        dlq.on('message', (messageString) => {
            expect(messageString).to.be.a('string').and.eql(msg);
            queue.stop();
            dlq.stop();
            done();
        });

        queue.start().then(() => {
            dlq.start().then(() => {
                queue.publish(msg);
            });
        });

    });
});
