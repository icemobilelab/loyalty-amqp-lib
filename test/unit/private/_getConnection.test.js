import { expect } from 'chai';
import { EventEmitter } from 'events';
import config from '../../config.js';
import constructor from '../../util/constructor.js';
import { AMQP } from '../../../lib/amqp-base.js';

// Factory to produce a mockable version of _getConnection
function getConnectionFactory(mockCreateConnection) {
  const activeLocks = new WeakMap();
  return async function _getConnection(base) {
    if (base._connection) return base._connection;

    if (!activeLocks.has(base)) {
      const lock = (async () => {
        const conn = await mockCreateConnection();
        base._connection = conn;
        return conn;
      })();
      activeLocks.set(base, lock);
    }

    return activeLocks.get(base);
  };
}

describe('_getConnection (mocked)', () => {
  let base;
  let mockConnection;

  beforeEach(() => {
    base = new AMQP(constructor(config));
    mockConnection = new EventEmitter();
    mockConnection.createChannel = async () => ({});
  });

  it('Successfully gets a connection', async () => {
    const _getConnection = getConnectionFactory(async () => mockConnection);
    const connection = await _getConnection(base);
    expect(connection).to.exist;
    expect(connection).to.have.property('createChannel');
  });

  it('Only creates a connection once', async () => {
    const spy = { count: 0 };
    const _getConnection = getConnectionFactory(async () => {
      spy.count++;
      return mockConnection;
    });

    const conn = await Promise.race([_getConnection(base), _getConnection(base), _getConnection(base)]);
    expect(conn).to.exist;
    expect(base._connection).to.equal(conn);
    expect(spy.count).to.equal(1);
  });

  it('All created connections match', async () => {
    const _getConnection = getConnectionFactory(async () => mockConnection);
    const results = await Promise.all([_getConnection(base), _getConnection(base), _getConnection(base)]);
    for (const conn of results) {
      expect(conn).to.equal(base._connection);
    }
  });
});
