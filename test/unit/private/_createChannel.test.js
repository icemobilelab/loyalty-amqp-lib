'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_createChannel', () => {

    const _createChannel = AMQP.__get__('_createChannel');
    const base = new AMQP.AMQP(constructor(config));

    it('creates a new channel, sets it on base', async function () {
        const channel = await _createChannel(base, false);
        expect(channel).to.deep.equal(base._channel);
    });

    it('check created channel health', async function () {
        const channel = await _createChannel(base, false);
        expect(channel).to.deep.equal(base._channel);
        return channel.checkExchange('amq.direct');
    });

});