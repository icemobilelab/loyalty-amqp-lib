'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_connect', () => {

    const connection = new EventEmitter();
    connection.close = () => Promise.resolve();
    connection.checkExchange = () => Promise.resolve();
    connection.createChannel = () => Promise.resolve(connection);
    AMQP.__set__('_createConnection', () => {
        return Promise.resolve(connection);
    });
    const _connect = AMQP.__get__('_connect');
    let base;
    beforeEach(function () {
        base = new AMQP.AMQP(constructor(config));
    });
    afterEach(function () {
        connection.removeAllListeners();
        base.removeAllListeners();
    });

    it('Successfully connects', async function () {
        const conn = await _connect(base);
        expect(conn, 'returns created connection').to.be.eql(connection);
    });

    it('Emits connect event', function (done) {
        base.once('connect', done);
        _connect(base);
    });

    it('Emits reconnect event', function (done) {
        base.once('reconnect', done);
        _connect(base, true);
    });

    it('Emits disconnect event', function (done) {
        base.once('disconnect', () => {
            done();
        });

        _connect(base)
            .then((conn) => {
                conn.emit('close', new Error('test error'));
            });
    });

    it('Calls close handler on connection close', function (done) {
        const error = new Error('test error');
        AMQP.__set__('_connectionCloseHandler', (base, err) => {
            expect(err).to.be.eql(error);
            done();
        });
        _connect(base)
            .then((conn) => {
                conn.emit('close', error);
            });
    });
});
