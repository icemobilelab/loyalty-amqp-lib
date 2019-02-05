'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_getConnection', () => {


    async function _getConnection(base) {
        const inner = AMQP.__get__('_getConnection');
        const res = await inner(base);
        return res;
    }

    it('Successfully gets a connection', async function () {
        this.timeout(10000);
        const base = new AMQP.AMQP(constructor(config));

        const res = await _getConnection(base);
        return res;
    });

    it('Only creates a connection once', async function () {
        this.timeout(10000);
        const base = new AMQP.AMQP(constructor(config));

        return Promise.race([
            _getConnection(base),
            _getConnection(base),
            _getConnection(base)
        ]).then(conn => {
            expect(
                base._connection,
                'connection object only created once'
            ).is.eql(conn);
        });
    });

    it('All created connections match the first', async function () {
        this.timeout(10000);
        const base = new AMQP.AMQP(constructor(config));

        return Promise.all([
            _getConnection(base),
            _getConnection(base),
            _getConnection(base)
        ]).then(results => {
            for (let conn of results) {
                expect(
                    base._connection,
                    'connection object is idempotent'
                ).is.eql(conn);
            }
        });
    });
});
describe('_setConnection', () => {


    function _setConnection(base) {
        const inner = AMQP.__get__('_setConnection');
        const res = inner(base);
        return res;
    }

    it('Successfully sets a connection', function () {
        this.timeout(2000);

        const testValue = 'test';
        const base = new AMQP.AMQP(constructor(config));
        console.log('[_setConnection:test] base._connection:', base._connection);
        base._connection = 'test';
        console.log('[_setConnection:test] base._connection:', base._connection);
        _setConnection(base, testValue);
        console.log('[_setConnection:test] base._connection:', base._connection);
        expect(base._connection).to.be.eql(testValue);
    });
    it('Successfully sets a connection to undefined', function () {
        this.timeout(2000);

        const testValue = undefined;
        const base = new AMQP.AMQP(constructor(config));
        console.log('[_setConnection:test] base._connection:', base._connection);
        base._connection = 'incorrect_value';
        console.log('[_setConnection:test] base._connection:', base._connection);
        _setConnection(base, testValue);
        console.log('[_setConnection:test] base._connection:', base._connection);
        expect(base._connection).to.be.eql(testValue);
    });
});