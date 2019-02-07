'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_closeChannel', () => {

    const _createChannel = AMQP.__get__('_createChannel');
    const _closeChannel = AMQP.__get__('_closeChannel');

    const base = new AMQP.AMQP(constructor(config));
    let channel;

    beforeEach(async () => {
        channel = await _createChannel(base, false);
    });

    it('should set channel to undefined', async function () {
        await _closeChannel(base);
        expect(base._channel).to.equal(undefined);
    });

    it('should remove listeners on channel', async function () {
        await _closeChannel(base);
        expect(channel.listenerCount('close')).to.equal(0);
        expect(channel.listenerCount('error')).to.equal(0);
    });

    it('should be unable to assert queue on closed channel', async function () {
        await _closeChannel(base);
        channel.assertQueue('should-not-be-possible').catch(err => {
            expect(err.message).to.equal('Channel closed');
        });
    });

});