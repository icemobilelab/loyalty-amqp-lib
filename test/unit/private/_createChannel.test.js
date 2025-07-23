import { expect } from 'chai';
import { EventEmitter } from 'events';
import config from '../../config.js';
import constructor from '../../util/constructor.js';
import { AMQP, _createChannel } from '../../../lib/amqp-base.js';

describe('_createChannel', () => {
  it('creates a new channel, sets it on base', async function () {
    const base = new AMQP(constructor(config));

    // Mock connection with the createChannel method
    const mockConnection = new EventEmitter();
    mockConnection.createChannel = () => {
      return Promise.resolve(new EventEmitter());
    };
    base._connection = mockConnection;

    const channel = await _createChannel(base);
    expect(channel).to.exist;
    expect(base._channel).to.deep.equal(channel);
  });
});
