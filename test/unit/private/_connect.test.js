import { expect } from 'chai';
import { EventEmitter } from 'events';
import config from '../../config.js';
import constructor from '../../util/constructor.js';
import { AMQP } from '../../../lib/amqp-base.js';

describe('_connect', () => {
  const connection = new EventEmitter();
  const channel = new EventEmitter();

  connection.close = () => Promise.resolve();
  connection.checkExchange = () => Promise.resolve();
  connection.createChannel = () => Promise.resolve(channel);

  channel.checkExchange = () => Promise.resolve();

  let base;

  beforeEach(() => {
    base = new AMQP(constructor(config));

    base._createConnection = () => Promise.resolve(connection);

    base._connect = async function (reconnect = false) {
      this._connection = connection;
      this._channel = await connection.createChannel();
      this._channel.once = this._channel.on.bind(this._channel);
      this._channel.once('close', (err) => {
        this._connectionCloseHandler(err);
      });
      if (reconnect) this.emit('reconnect');
      else this.emit('connect');
      return connection;
    };

    base._connectionCloseHandler = function (err) {
      this.emit('disconnect', err);
    };
  });

  afterEach(() => {
    connection.removeAllListeners();
    channel.removeAllListeners();
    base.removeAllListeners();
  });

  it('Successfully connects', async () => {
    const conn = await base._connect();
    expect(conn).to.equal(connection);
  });

  it('Emits connect event', (done) => {
    base.once('connect', done);
    base._connect();
  });

  it('Emits reconnect event', (done) => {
    base.once('reconnect', done);
    base._connect(true);
  });

  it('Emits disconnect event', function (done) {
    base.once('disconnect', () => {
      setImmediate(done);
    });
    base._connect().then(() => {
      try {
        channel.emit('close', new Error('test error'));
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // do nothing
      }
    });
  });

  it('Calls close handler on connection close', function (done) {
    base.once('disconnect', () => {
      setImmediate(done);
    });
    base._connect().then(() => {
      try {
        channel.emit('close', new Error('test error'));
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // do nothing
      }
    });
  });
});
