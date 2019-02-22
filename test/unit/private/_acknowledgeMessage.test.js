'use strict';

const { EventEmitter } = require('events');
const { AMQPConsumer } = require('./../../../index');
const constructor = require('../../util/constructor');

describe('_acknowledgeMessage', () => {

    let consumer;
    let fakeChannel = new EventEmitter();
    beforeEach(() => {
        consumer = new AMQPConsumer(constructor('ack-test'));
        consumer.removeAllListeners();
        consumer._channel = fakeChannel;
    });

    it('Calls channel ACK', function (done) {
        consumer._channel.ack = done;
        consumer.acknowledgeMessage();
    });

    it('Handles error on ACK', function (done) {
        consumer._channel.ack = () => {
            throw new Error('test error');
        };
        consumer.acknowledgeMessage()
            .then(done);
    });

    it('Emits `disconnect` event if ACK destroys channel', function (done) {
        consumer._channel.ack = () => {
            delete consumer._channel;
            return Promise.resolve();
        };
        consumer.once('disconnect', done);
        consumer.acknowledgeMessage();
    });
});
