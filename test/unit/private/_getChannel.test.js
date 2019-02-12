'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const mockLogger = require('../../util/mock-logger');

describe('_getChannel', () => {

    const _getChannel = AMQP.__get__('_getChannel');

    it('returns existing channel if exists', async function () {
        const base = { _channel: new EventEmitter(), logger: mockLogger };
        const channel = await _getChannel(base, false);
        expect(channel).to.deep.equal(base._channel);
    });

    it('creates new channel if none exists', async function () {

        // todo: some extensive mocking here, need to test
        // this with a real channel and exchange
        const base = { _channel: undefined, logger: mockLogger };
        const newChannel = new EventEmitter();
        newChannel.checkExchange = channel => Promise.resolve(channel);

        AMQP.__set__('_createChannel', async function () {
            return newChannel;
        });

        const channel = await _getChannel(base, false);
        expect(channel).to.deep.equal(newChannel);
    });

});