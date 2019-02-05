'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const sinon = require('sinon');
const mockLogger = require('../../util/mock-logger');

describe('_getChannelConsumer', () => {

    const _getChannelConsumer = AMQP.__get__('_getChannelConsumer');

    it('should return a function', function (done) {
        expect(typeof _getChannelConsumer()).to.equal('function');
        done();
    });

    it('returned function should call emit on base', function (done) {
        const base = { emit: sinon.fake() };
        const channelConsumer = _getChannelConsumer(base, mockLogger);
        const message = 'hello there';
        const data = { fields: [], content: message };
        channelConsumer(data);
        expect(base.emit.callCount).to.equal(1);
        expect(base.emit.getCall(0).args[1]).to.equal(message);
        done();
    });

});