'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_connect', () => {

    AMQP.__set__('_connectionCloseHandler', function(...args) {
        console.log('correct:', ...args);
        done();
    });
    async function _connect(base, ...args) {
        const inner = AMQP.__get__('_connect');
        return await inner(base, ...args);
    }
    const connection = new EventEmitter();
    AMQP.__set__('_createConnection', async () => {
        return Promise.resolve(connection);
    });

    const base = new AMQP.AMQP(constructor(config));
    // beforeEach(() => {
    //     base = new AMQP.AMQP(constructor(config));
    // });
    afterEach(() => {
        base.removeAllListeners();
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
    it('Calls close handler on connection close', function (done) {
        this.timeout(2000);

        _connect(base)
            .then((conn) => {
                conn.emit('close');
            });
    });
});
