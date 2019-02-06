'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer } = rewire('../../index');
const AMQP = rewire('../../lib/amqp-base');
const config = require('../config');
const queueOptions = require('../util/constructor');

describe('Listening to a queue', () => {

    let _getChannel = AMQP.__get__('_getChannel');
    let consumer = new AMQPConsumer(queueOptions(config));

    after(() => {
        consumer.stop();
    });

    it('Connects and listens to a queue', function (done) {
        consumer.once('listen', done);
        consumer.listen();
    });

    it.only('Handles errors when listening to a queue', function (done) {
        consumer.once('reconnect', done);
        consumer.listen();
        _getChannel(consumer)
            .then(channel => {
                channel.close();
            });
    });

    it('Listens to message events', function (done) {
        const msg = 'hello world';
        consumer.listen();
        consumer.once('message', message => {
            expect(message).to.be.eql(msg);
            done();
        });
        consumer.emit('message', msg);
    });
});
