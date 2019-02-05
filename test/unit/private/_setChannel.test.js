'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');
describe('_setChannel', () => {

    function _setChannel(base, ...args) {
        const inner = AMQP.__get__('_setChannel');
        const res = inner(base, ...args);
        return res;
    }

    it('Successfully sets a channel', function () {
        this.timeout(2000);

        const testValue = 'test';
        const base = new AMQP.AMQP(constructor(config));
        _setChannel(base, testValue);
        expect(base._channel).to.be.eql(testValue);
    });
    it('Successfully sets a connection to undefined', function () {
        this.timeout(2000);

        const testValue = undefined;
        const base = new AMQP.AMQP(constructor(config));
        base._channel = 'incorrect_value';
        _setChannel(base, testValue);
        expect(base._channel).to.be.eql(testValue);
    });
});