'use strict';

const { expect } = require('chai');
const uuid = require('uuid');
const rewire = require('rewire');
const { AMQPConsumer } = rewire('../../index');
const config = require('../config');
const queueOptions = require('../util/constructor');


describe('Starting up and shutting down the queue', () => {
    this.timeout(2000);

    let queue = new AMQPConsumer(queueOptions(config));
    beforeEach(() => {
        queue = new AMQPConsumer(queueOptions(config));
    });

    afterEach((done) => {
        Promise.resolve()
            .then(() => queue.stop())
            .then(() => queue.removeAllListeners())
            .then(() => done())
            .catch(err => done(err));
    });

    it('Retries connection to the AMQP server with maxTries', function (done) {
        //...
    });

    it('Retries connection indefinitely to the AMQP server without maxTries', function (done) {
        //...
    });

    it('Closes an open connection to AMQP', done => {
        //...
    });
});

describe('Handles AMQP disconnects', () => {

    it('Listens again on Channel close event', function (done) {
        //...
    });

    it('Listens again on Connection close event', function (done) {
        //...
    });
});