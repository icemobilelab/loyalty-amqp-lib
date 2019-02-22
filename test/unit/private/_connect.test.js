'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_connect', () => {

    const connection = new EventEmitter();
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
        const AMQP = rewire('../../../lib/amqp-base');
        const resolve = AMQP.__set__('_createConnection', () => {
            let result = new EventEmitter();
            result.close = () => Promise.resolve();
            result.createChannel = () => {
                return Promise.resolve(result);
            };
            return Promise.resolve(result);
        });
        base = new AMQP.AMQP(constructor(config));
        const _connect = AMQP.__get__('_connect');

        base.once('disconnect', () => {
            resolve();
            done();
        });

        _connect(base)
            .then((conn) => {
                conn.emit('close', new Error);
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
