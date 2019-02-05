'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const { AMQPConsumer } = rewire('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');

describe('Listening to a queue', () => {

    let consumer = new AMQPConsumer(queueOptions(config));

    after(() => {
        consumer.stop();
    });

    it('Connects and listens to a queue', function (done) {
        consumer.once('listen', done);
        consumer.listen();
    });

    it('Handles errors when listening to a queue', function (done) {
        done(new Error('TBD'));
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
