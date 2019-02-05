'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
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

    AMQP.__set__('_connect', async (instance) => {
        base._connection = new EventEmitter();
    });

    let base = new AMQP.AMQP(constructor(config));
    beforeEach(() => {
        base = new AMQP.AMQP(constructor(config));
    });

    it('Successfully gets a connection', async function () {
        this.timeout(10000);

        return await _getConnection(base);
    });

    it('Only creates a connection once', async function () {
        this.timeout(10000);

        return Promise.race([
            _getConnection(base),
            _getConnection(base),
            _getConnection(base)
        ]).then(conn => {
            expect(
                base._connection,
                'first created connection matches final'
            ).is.eql(conn);
        });
    });

    it('All created connections match', async function () {
        this.timeout(10000);

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
