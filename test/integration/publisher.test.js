import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { AMQPConsumer, AMQPPublisher } from '../../index.js';
import queueOptions from '../util/constructor.js';

describe('Publishing to an exchange', () => {
  let config;
  let consumer, producer;
  const testId = `publisher-${uuidv4()}`;

  beforeEach(() => {
    config = queueOptions(testId);
    consumer = new AMQPConsumer(config);
    producer = new AMQPPublisher(config);
  });

  afterEach(async () => {
    if (consumer) {
      consumer.removeAllListeners();
      await consumer.stop();
    }
  });

  it('Publishes a message to an exchange', async function () {
    this.timeout(2000);
    const msg = 'hello world';

    await consumer.listen();

    await new Promise((resolve) => {
      consumer.once('message', (received) => {
        expect(received).to.equal(msg);
        resolve();
      });
      producer.publish(msg);
    });
  });

  it('Publishes a message with headers to an exchange', async function () {
    this.timeout(2000);
    const msg = 'hello world';
    const headers = { a: uuidv4() };

    await consumer.listen();

    await new Promise((resolve, reject) => {
      consumer.once('message', (received, data) => {
        try {
          expect(received).to.equal(msg);
          expect(data.properties.headers).to.deep.equal(headers);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      producer.publish(msg, headers);
    });
  });

  it('Publishes a message to a queue', async function () {
    this.timeout(2000);
    const msg = 'hello world';

    await consumer.listen();

    await new Promise((resolve) => {
      consumer.once('message', (received) => {
        expect(received).to.equal(msg);
        resolve();
      });
      producer.publishToQueue(msg);
    });
  });

  it('Publishes a message with headers to a queue', async function () {
    this.timeout(2000);
    const msg = 'hello world';
    const headers = { a: uuidv4() };

    await consumer.listen();

    await new Promise((resolve, reject) => {
      consumer.once('message', (received, data) => {
        try {
          expect(received).to.equal(msg);
          expect(data.properties.headers).to.deep.equal(headers);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      producer.publishToQueue(msg, headers);
    });
  });

  it('Publishes a lot of messages', async function () {
    this.timeout(10000);
    const amount = 10;

    await consumer.listen();

    for (let i = 0; i <= amount; i++) {
      await producer.publish(`#${i}`);
    }

    return new Promise((resolve) => {
      consumer.on('message', (message) => {
        expect(message).to.be.a('string');
        if (message === `#${amount}`) {
          consumer.removeAllListeners();
          resolve();
        }
      });
    });
  });

  it('Handles errors when publishing a message', async function () {
    this.timeout(2000);
    const brokenProducer = new AMQPPublisher({
      ...queueOptions('testWithErrorMessage'),
      host: 'nonexistent-host-123', // force failure
    });

    await new Promise((resolve) => {
      brokenProducer.once('error', (err) => {
        expect(err).to.exist;
        resolve();
      });
      brokenProducer.publish('we expect this to break');
    });
  });
});
