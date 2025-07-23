import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

import { AMQPConsumer, AMQPPublisher } from '../../index.js';
import { _getChannel } from '../../lib/amqp-base.js';
import queueOptions from '../util/constructor.js';

describe('Dead Letter Queue (DLQ)', () => {
  let consumer, producer, dlqConsumer;
  let config;
  const testId = `deadletter-${uuidv4()}`;

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
    if (dlqConsumer) {
      dlqConsumer.removeAllListeners();
      await dlqConsumer.stop();
    }
  });

  it('Sends non-acknowledged messages to the dead letter queue', async function () {
    this.timeout(10000);

    const deadLetterQueueName = `${config.deadLetterExchange}.queue`;
    const dlqOptions = {
      ...config,
      queue: deadLetterQueueName,
      isDeadLetterConsumer: true,
      serviceName: `${testId}-dlq`,
    };

    const testMessage = 'Dead pigeon';

    dlqConsumer = new AMQPConsumer(dlqOptions);
    await dlqConsumer.listen();
    await consumer.listen();

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test timed out')), 8000);

      dlqConsumer.once('message', (receivedMsg) => {
        try {
          expect(receivedMsg).to.be.a('string').and.equal(testMessage);
          clearTimeout(timeout);
          resolve();
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      consumer.once('message', async (_msg, data) => {
        const channel = await _getChannel(consumer);
        channel.nack(data, false, false); // force dead-lettering
      });

      producer.publish(testMessage);
    });
  });
});
