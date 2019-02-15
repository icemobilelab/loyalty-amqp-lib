'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_closeChannel', () => {

    const _createChannel = async (base) => {
        base._channel = await Promise.resolve(new EventEmitter);
        base._channel.close = function() {
            // this.emit('error', new Error());
            // this.emit('close', new Error());
        };
    };
    const _closeChannel = AMQP.__get__('_closeChannel');
    let base = new AMQP.AMQP(constructor(config));
    beforeEach(async () => {
        base = new AMQP.AMQP(constructor(config));
        await _createChannel(base);
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