'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');
describe('_setConnection', () => {

    function _setConnection(base, ...args) {
        const inner = AMQP.__get__('_setConnection');
        const res = inner(base, ...args);
        return res;
    }

    it('Successfully sets a connection', function () {
        this.timeout(2000);

        const testValue = 'test';
        const base = new AMQP.AMQP(constructor(config));
        _setConnection(base, testValue);
        expect(base._connection).to.be.eql(testValue);
    });
    it('Successfully sets a connection to undefined', function () {
        this.timeout(2000);

        const testValue = undefined;
        const base = new AMQP.AMQP(constructor(config));
        base._connection = 'incorrect_value';
        _setConnection(base, testValue);
        expect(base._connection).to.be.eql(testValue);
    });
});