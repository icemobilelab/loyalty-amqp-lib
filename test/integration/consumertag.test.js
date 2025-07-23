import { expect } from 'chai';
import { AMQPConsumer, AMQPPublisher } from '../../index.js';
import { _getConnection, _getChannel } from '../../lib/amqp-base.js';
import queueOptions from '../util/constructor.js';

let counter = 0;
function getOptions(serviceName = `consumer-tag-${++counter}`) {
  return {
    ...queueOptions(serviceName),
    serviceName,
  };
}

describe('(re)connects with consumer tag', () => {
  let consumer;
  let producer;
  after((done) => {
    setTimeout(() => {
      if (consumer) {
        consumer.removeAllListeners();
        consumer.stop();
      }
      if (producer) {
        producer.removeAllListeners();
        producer.stop();
      }
      done();
    }, 200);
  });

  describe('Starting up the queue and listening', () => {
    it('Connects to the broker with consumer tag', async function () {
      this.timeout(10000);

      consumer = new AMQPConsumer(getOptions('ctag-listener'));

      consumer.listen();
      return new Promise((resolve) => {
        consumer.once('listen', resolve);
      });
    });

    it('Connects to the broker with producer/consumer using same consumer tag', async function () {
      this.timeout(10000);

      const options = getOptions('ctag-listener');
      consumer = new AMQPConsumer(options);
      producer = new AMQPPublisher(options);

      const consumerListener = new Promise((resolve) => {
        consumer.once('listen', resolve);
        consumer.listen();
      });
      const producerConnection = new Promise((resolve) => {
        producer.once('connect', resolve);
        producer.publish('test');
      });

      return await Promise.all([consumerListener, producerConnection]);
    });

    it('Connects to the broker with multiple instances using same consumer tag', async function () {
      this.timeout(10000);

      const options = getOptions('ctag-listener');
      consumer = new AMQPConsumer(options);
      const consumer2 = new AMQPConsumer(options);

      const consumerListener = new Promise((resolve) => {
        consumer.once('listen', resolve);
        consumer.listen();
      });
      const consumerListener2 = new Promise((resolve) => {
        consumer2.once('listen', resolve);
        consumer2.listen();
      });

      await Promise.all([consumerListener, consumerListener2]);

      // Clean up the second consumer
      consumer2.removeAllListeners();
      await consumer2.stop();
    });

    it('Listens to message events', async function () {
      this.timeout(10000);
      const message = 'hello world';
      const options = getOptions('ctag-publisher');
      producer = new AMQPPublisher(options);
      consumer = new AMQPConsumer(options);

      await consumer.listen();

      return new Promise((resolve) => {
        consumer.once('message', (msg) => {
          expect(message).to.be.eql(msg);
          consumer.stop();
          resolve();
        });
        producer.publish(message);
      });
    });
  });

  describe('Handles AMQP disconnects', () => {
    it('Reconnects on Channel close event', function (done) {
      this.timeout(5000);
      consumer = new AMQPConsumer(getOptions('ctag-listener'));

      consumer.once('reconnect', done);
      consumer.listen().then(() => {
        _getChannel(consumer).then((channel) => {
          channel.close();
        });
      });
    });

    it('Reconnects on Connection close event', function (done) {
      this.timeout(50000);
      consumer = new AMQPConsumer(getOptions('ctag-reconnect-conn-close'));

      consumer.once('reconnect', () => {
        done();
      });
      consumer.listen().then(() => {
        _getConnection(consumer, false).then((conn) => {
          // conn.close();
          conn.emit('close', new Error());
        });
      });
    });

    it('Listens again on Channel close event', function (done) {
      this.timeout(5000);
      const options = getOptions('ctag-reconnect-publisher');
      consumer = new AMQPConsumer(options);
      const producer = new AMQPPublisher(options);
      const message = 'Test message';

      consumer.once('reconnect', () => {
        consumer.once('listen', () => {
          producer.publish(message);
          consumer.once('message', (msg) => {
            expect(message, 'Received the wrong message').to.eql(msg);
            consumer.stop();
            producer.stop();
            done();
          });
        });
      });
      consumer.listen().then(() => {
        _getChannel(consumer).then((channel) => {
          channel.close();
        });
      });
    });

    it('Listens again on Connection close event', function (done) {
      this.timeout(5000);
      consumer = new AMQPConsumer(getOptions('ctag-listener-conn-close'));

      consumer.once('reconnect', () => {
        consumer.once('listen', done);
      });
      consumer.listen().then(() => {
        _getConnection(consumer, false).then((conn) => {
          // conn.close();
          conn.emit('close', new Error());
        });
      });
    });
  });

  describe('Subscribing to multiple queues with the same consumer tag', () => {
    it('Connects to multiple queues with same consumer tag', async function () {
      this.timeout(10000);

      // Setup multiple consumers
      let options = getOptions('ctag-multi-listener');
      options.serviceName = 'ctag-busy-service';
      const nrConsumers = 3;
      const consumers = [...Array(nrConsumers)].map(() => new AMQPConsumer(options));

      // Confirm all calls made before resolving
      let count = 0;
      function resolver(resolve) {
        if (++count === nrConsumers) {
          resolve();
          consumers.forEach((consumer) => {
            consumer.stop();
          });
        }
      }

      // Resolve after all consumers issue listen event
      for (let consumer of consumers) {
        consumer.listen();
      }

      return new Promise((resolve) => {
        for (let consumer of consumers) {
          consumer.once('listen', resolver.bind(this, resolve));
        }
      });
    });
  });
});
