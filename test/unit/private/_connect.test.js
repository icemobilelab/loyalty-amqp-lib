'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_connect', () => {

    const _connect = AMQP.__get__('_connect');
    const connection = new EventEmitter();
    const mitty = new EventEmitter();

    AMQP.__set__('_createConnection', async () => {
        return Promise.resolve(connection);
    });
    AMQP.__set__('_connectionCloseHandler', function (...args) {
        mitty.emit('handledClose');
    });

    let base;
    beforeEach(function () {
        base = new AMQP.AMQP(constructor(config));
    });

    it('Successfully connects', async function () {
        this.timeout(2000);
        const conn = await _connect(base);
        expect(conn, 'returns created connection').to.be.eql(connection);
    });

    it('Emits connect event', function (done) {
        this.timeout(2000);
        base.once('connect', done);
        _connect(base);
    });

    it('Emits reconnect event', function (done) {
        this.timeout(2000);
        base.once('reconnect', done);
        _connect(base, true);
    });

    it('Emits disconnect event', function (done) {
        this.timeout(2000);
        base.once('disconnect', done);
        _connect(base)
            .then((conn) => {
                conn.emit('close');
            });
    });

    it('Calls close handler on connection close', function (done) {
        this.timeout(2000);

        mitty.once('handledClose', done);

        _connect(base)
            .then((conn) => {
                conn.emit('close');
            });
    });
});
