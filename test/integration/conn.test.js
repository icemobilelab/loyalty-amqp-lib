import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { AMQPConsumer } from '../../index.js';
import { AMQP, _connect, _createChannel, _getChannel, _getConnection } from '../../lib/amqp-base.js';
import queueOptions from '../util/constructor.js';

describe('Handle connecting & disconnecting', () => {
  describe('Starting up the queue', () => {
    it('check created channel health', async function () {
      const queueName = `checkChannel-${uuidv4()}`;
      const base = new AMQP(queueOptions(queueName));
      await _connect(base);
      const channel = await _createChannel(base);

      expect(channel).to.deep.equal(base._channel);
      await channel.checkExchange('amq.direct');
    });

    it('Retries connection to the AMQP server with maxTries', async function () {
      this.timeout(10000);

      const maxTries = 2;
      const queueName = `maxTries-${uuidv4()}`;
      let options = queueOptions(queueName);
      options.host = 'nonexistent-host-12345'; // Use a host that definitely doesn't exist
      options.retry.maxTries = maxTries;
      options.retry.interval = 100; // Short interval for testing

      let queue = new AMQPConsumer(options);

      try {
        await queue.listen();
        // Should not reach here
        expect.fail('Expected connection to fail');
      } catch (err) {
        // Should get ENOTFOUND or similar network error
        expect(['ENOTFOUND', 'ECONNREFUSED']).to.include(err.code);
      }
    });

    it('Retries connection to the AMQP server indefinitely', async function () {
      this.timeout(3000);

      const maxTries = -1;
      const queueName = `retryIndefinitely-${uuidv4()}`;
      let options = queueOptions(queueName);
      options.host = 'nonexistent-host-67890'; // Use a host that definitely doesn't exist
      options.retry.maxTries = maxTries;
      options.retry.interval = 100; // Short interval for testing

      let queue = new AMQPConsumer(options);

      const listenPromise = queue.listen();

      // Should keep retrying indefinitely, so this should timeout
      const result = await Promise.race([
        listenPromise.then(() => 'connected'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 2000)),
      ]);

      expect(result).to.equal('timeout');
    });
  });

  describe('Shutting down the queue', () => {
    let queue;

    afterEach(async function () {
      if (queue && queue._connection) {
        try {
          await queue.stop();
          if (queue._connection) {
            await queue._connection.close();
          }
          // eslint-disable-next-line no-unused-vars
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });

    it('Closes an open connection to AMQP', function (done) {
      this.timeout(5000);

      const queueName = `shutDown-${uuidv4()}`;
      const options = queueOptions(queueName);

      queue = new AMQPConsumer(options);

      // Add timeout fallback to prevent hanging
      const timeoutId = setTimeout(() => {
        done(new Error('Test timed out waiting for close event'));
      }, 4500);

      queue.once('close', () => {
        clearTimeout(timeoutId);
        try {
          expect(queue._connection).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });

      queue.once('error', (err) => {
        clearTimeout(timeoutId);
        done(err);
      });

      queue
        .listen()
        .then(() => {
          return queue.stop();
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          done(err);
        });
    });

    it('should be unable to assert queue on closed channel', async function () {
      const queueName = `test-closed-channel-${uuidv4()}`;
      const base = new AMQP(queueOptions(queueName));
      await _connect(base);
      const channel = await _getChannel(base, false);

      channel.removeAllListeners();
      await channel.close();
      return channel
        .assertQueue('should-not-be-possible')
        .then(() => {
          throw new Error();
        })
        .catch((err) => {
          expect(err.message).to.contain('Channel closed');
        });
    });
  });

  describe('Handles AMQP disconnects', () => {
    let queue;
    beforeEach(() => {
      const queueName = `handlesDisconnects-${uuidv4()}`;
      queue = new AMQPConsumer(queueOptions(queueName));
    });

    afterEach(async () => {
      // when a channel is closing, it takes some time before it has
      // actually been closed, calling .stop() on a queue will try
      // and close the already closing channel, this timeout prevents that.
      // channel.close() does return a promise, but it resolves before
      // the channel has actually been closed(!)
      await new Promise((resolve) => setTimeout(resolve, 400));
      await queue.stop();
    });

    it('Reconnects on Channel close event', function (done) {
      this.timeout(5000);

      queue.once('reconnect', () => {
        done();
      });
      queue.listen().then(() => {
        _getChannel(queue).then((channel) => {
          channel.close();
        });
      });
    });

    it('Reconnects on Connection close event', function (done) {
      this.timeout(5000);

      queue.once('reconnect', () => {
        done();
      });
      queue.listen().then(() => {
        _getConnection(queue, false).then((conn) => {
          conn.emit('close', new Error());
        });
      });
    });

    it('Listens again on Channel close event', function (done) {
      this.timeout(5000);

      queue.once('reconnect', () => {
        queue.once('listen', () => {
          queue.stop().then(done);
        });
      });
      queue.listen().then(() => {
        _getChannel(queue).then((channel) => {
          channel.close();
        });
      });
    });

    it('Listens again on Connection close event', function (done) {
      this.timeout(5000);

      queue.once('reconnect', () => {
        queue.once('listen', () => {
          queue.stop().then(done);
        });
      });
      queue.listen().then(() => {
        _getConnection(queue, false).then((conn) => {
          conn.emit('close', new Error());
        });
      });
    });
  });
});
