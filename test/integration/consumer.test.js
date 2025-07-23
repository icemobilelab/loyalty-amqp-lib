import { expect } from 'chai';
import { AMQPConsumer, AMQPPublisher } from '../../index.js';
import { _connect, _getChannel } from '../../lib/amqp-base.js';
import queueOptions from '../util/constructor.js';

describe('Consumer Integration Tests', () => {
  describe('Listening to a queue', () => {
    let consumer, producer, config;
    let testNum = 0;

    beforeEach(() => {
      config = queueOptions(`consumer-${++testNum}`);
      consumer = new AMQPConsumer(config);
      producer = new AMQPPublisher(config);
    });

    afterEach(async () => {
      if (consumer) {
        consumer.removeAllListeners();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await consumer.stop();
      }
    });

    it('Connects and listens to a queue', async function () {
      this.timeout(5000);
      const promise = new Promise((resolve) => consumer.once('listen', resolve));
      await consumer.listen();
      await promise;
    });

    it('Handles errors when listening to a queue', async function () {
      this.timeout(5000);
      await _connect(consumer);
      const channel = await _getChannel(consumer, false);

      const reconnectPromise = new Promise((resolve) => consumer.once('reconnect', resolve));

      await consumer.listen();
      await channel.close();

      await reconnectPromise;
    });

    it('Listens to message events', async function () {
      this.timeout(5000);
      const message = 'hello world';

      const promise = new Promise((resolve) => {
        consumer.once('message', (msg) => {
          expect(msg).to.equal(message);
          resolve();
        });
      });

      await consumer.listen();
      await producer.publish(message);
      await promise;
    });

    it('Acknowledging a message', async function () {
      this.timeout(5000);
      const message = 'hello world';

      const promise = new Promise((resolve) => {
        consumer.once('message', async (msg, data) => {
          expect(msg).to.equal(message);
          await consumer.acknowledgeMessage(data);
          resolve();
        });
      });

      await consumer.listen();
      await producer.publish(message);
      await promise;
    });

    it('Acknowledging an already acknowledged message', async function () {
      this.timeout(5000);
      const message = 'hello world';

      const promise = new Promise((resolve) => {
        consumer.once('disconnect', resolve);
        consumer.once('message', async (msg, data) => {
          expect(msg).to.equal(message);
          await consumer.acknowledgeMessage(data);
          await consumer.acknowledgeMessage(data); // second call should cause channel error
        });
      });

      await consumer.listen();
      await producer.publish(message);
      await promise;
    });
  });

  describe('(N)Acking messages', () => {
    it('Rejecting a message', async function () {
      this.timeout(8000);
      const message = 'hello world';

      const config = queueOptions('consumer-reject-1');
      config.noAck = false;

      const consumer = new AMQPConsumer(config);
      const producer = new AMQPPublisher(config);

      const dlqConfig = {
        ...config,
        queue: config.deadLetterExchange,
        isDeadLetterConsumer: true,
      };

      const deadLetterConsumer = new AMQPConsumer(dlqConfig);

      const dlqPromise = new Promise((resolve) => {
        deadLetterConsumer.once('message', (msg) => {
          expect(msg).to.equal(message);
          resolve();
        });
      });

      await deadLetterConsumer.listen();
      await consumer.listen();

      consumer.once('message', async (msg, data) => {
        expect(msg).to.equal(message);
        await consumer.rejectMessage(data);
      });

      await producer.publish(message);
      await dlqPromise;
    });

    it('Rejecting an already rejected message', async function () {
      this.timeout(5000);
      const message = 'hello world';

      const config = queueOptions('consumer-reject-2');
      const consumer = new AMQPConsumer(config);
      const producer = new AMQPPublisher(config);

      const disconnectPromise = new Promise((resolve) => {
        consumer.once('disconnect', resolve);
      });

      consumer.once('message', async (msg, data) => {
        expect(msg).to.equal(message);
        await consumer.rejectMessage(data);
        await consumer.rejectMessage(data);
      });

      await consumer.listen();
      await producer.publish(message);
      await disconnectPromise;
    });
  });
});
