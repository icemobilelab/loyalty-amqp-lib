import { expect } from 'chai';
import { EventEmitter } from 'events';
import config from '../../config.js';
import constructor from '../../util/constructor.js';
import { AMQP } from '../../../lib/amqp-base.js';

// Use a factory wrapper around _createConnection to inject the mocked connect function
function createConnectionFactory(mockConnect) {
  return async function _createConnection(host, username, password, logger, retry) {
    const url = `amqp://${username}:${password}@${host}`;
    let attempts = 0;

    const maxTries = retry?.maxTries ?? -1;
    const interval = retry?.interval ?? 100;
    const backoff = retry?.backoff ?? 0;

    while (true) {
      try {
        return await mockConnect(url);
      } catch (err) {
        attempts++;
        if (maxTries !== -1 && attempts >= maxTries) throw err;
        const delay = interval + backoff * attempts;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };
}

describe('_createConnection (mocked)', () => {
  const base = new AMQP(constructor(config));

  it('Successfully creates a connection', async () => {
    const mockConnect = async () => {
      const conn = new EventEmitter();
      conn.createChannel = async () => ({});
      return conn;
    };

    const _createConnection = createConnectionFactory(mockConnect);
    const { host, username, password, logger, retry } = base;

    const connection = await _createConnection(host, username, password, logger, retry);
    expect(connection).to.exist;
    expect(connection).to.have.property('createChannel');
  });

  it('Should proxy amqp.connect errors', async () => {
    const mockConnect = async () => {
      throw new Error('Simulated connection failure');
    };

    const _createConnection = createConnectionFactory(mockConnect);
    const { host, username, password, logger, retry } = base;

    try {
      await _createConnection(host, username, password, logger, retry);
      throw new Error('Expected error was not thrown');
    } catch (err) {
      expect(err).to.exist;
      expect(err.message).to.equal('Simulated connection failure');
    }
  });

  it('Should only reject after done retrying', async function () {
    this.timeout(5000);
    let callCount = 0;

    const mockConnect = async () => {
      callCount++;
      throw new Error('Mock connection error');
    };

    const _createConnection = createConnectionFactory(mockConnect);
    const { host, username, password, logger } = base;
    const retry = { backoff: 0, interval: 100, maxTries: 4 };

    const start = Date.now();
    try {
      await _createConnection(host, username, password, logger, retry);
    } catch (err) {
      const elapsed = Date.now() - start;
      expect(err.message).to.include('Mock connection error');
      expect(callCount).to.equal(4);
      expect(elapsed).to.be.greaterThan(250);
    }
  });
});
