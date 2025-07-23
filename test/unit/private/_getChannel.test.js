import { expect } from 'chai';
import { EventEmitter } from 'events';
import { _getChannel } from '../../../lib/amqp-base.js';
import mockLogger from '../../util/mock-logger.js';
import locks from 'locks';

describe('_getChannel', () => {
  it('returns existing channel if exists', async function () {
    const base = {
      _channel: new EventEmitter(),
      logger: mockLogger,
      lock: locks.createReadWriteLock(),
    };
    const channel = await _getChannel(base, false);
    expect(channel).to.deep.equal(base._channel);
  });

  it('creates new channel if none exists', async function () {
    const mockConnection = new EventEmitter();
    mockConnection.createChannel = () => {
      const newChannel = new EventEmitter();
      newChannel.checkExchange = () => Promise.resolve();
      return Promise.resolve(newChannel);
    };

    const base = {
      _channel: undefined,
      logger: mockLogger,
      lock: locks.createReadWriteLock(),
      _connection: mockConnection,
    };

    const channel = await _getChannel(base);
    expect(channel).to.exist;
    expect(base._channel).to.deep.equal(channel);
  });
});
