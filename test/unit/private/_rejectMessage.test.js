import { EventEmitter } from 'events';
import { AMQPConsumer } from '../../../index.js';
import constructor from '../../util/constructor.js';

describe('_rejectMessage', () => {
  let consumer;
  let fakeChannel = new EventEmitter();
  beforeEach(() => {
    consumer = new AMQPConsumer(constructor('ack-test'));
    consumer.removeAllListeners();
    consumer._channel = fakeChannel;
  });

  it('Calls channel NACK', function (done) {
    consumer._channel.nack = done;
    consumer.rejectMessage();
  });

  it('Handles error on NACK', function (done) {
    consumer._channel.nack = () => {
      throw new Error('test error');
    };
    consumer.rejectMessage().then(done);
  });

  it('Emits `disconnect` event if NACK destroys channel', function (done) {
    consumer._channel.nack = () => {
      delete consumer._channel;
      return Promise.resolve();
    };
    consumer.once('disconnect', done);
    consumer.rejectMessage();
  });
});
