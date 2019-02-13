# loyalty-amqp-lib
Common library for connecting to _RabbitMQ_



## About loyalty-amqp-lib
The library allows you to consume (listen to) messages from a _RabbitMQ_ queue, or to publish a message to a _RabbitMQ_ exchange.


The functionality in this library used to be part of the https://github.com/icemobilelab/loyalty-commons-v4 package. The _RabbitMQ_ functionality has moved into its own package, and is now properly versioned (semver) and hosted in a private NPM registry.
 

​


## Usage of the common _RabbitMQ_ library

Using the library is straightforward, once you’ve added it as a dependency in your project, you can import/require it into your code:

```javascript
const { AMQPConsumer, AMQPPublisher } = require('loyalty-amqp-lib');
```



The first thing to do is to create a new instance of the `AMQPPublisher` or the `AMQPConsumer`. You need to pass it an options object that contains the configuration for the connection and the name of the queue/exchange to connect to, and specifics such as the route. More details on this can be found in the jsdoc comments for the class constructor in the [consumer](lib/amqp-consumer.js)/[publisher](lib/amqp-publisher.js).


### 1 – Consuming a queue

```javascript
const consumer = new AMQPConsumer(options);
consumer.on('message', message => {
    // do your magic.
});
await consumer.listen();
```

### 2 – Publishing to an exchange

```javascript
const publisher = new AMQPPublisher(options);
const message = 'hello world';
await producer.publish(message);
```

## Event flows _RabbitMQ_

### Consume, listen to a queue
— If listening to a queue succeeds, a `listen` event will be emitted. If listening fails, an `error` event will be emitted. Once you are listening to a queue, a `message` event will be emitted when a message comes in.

### Publish a message
— When a message fails to be published an `error` event will be emitted

### Close a connection
— When we call `stop()` on an instance of the consumer or publisher, the connection and channel are closed. Once both the channel and connection have closed, a `close` event will be emitted.

### When a channel closes
When a close event has been emitted on a channel, and the close event has an error, the base class will emit a `disconnect` event, recreate the channel, and then emit a `reconnect` event.

### List of events
* base/`connect`
* base/`disconnect`
* base/`reconnect`
* base/`error`
* consumer/`listen`
* consumer/`message`


### Example sequences of events

Consuming (happy flow)

`connect` |
`listen` |
`message` |
`message` |
`message` |
`message` |
`disconnect` |
`reconnect` |
`message` |
`message` |
`close`


Consuming (happy flow with disconnect + reconnect)

`connect` |
`listen` |
`message` |
`message` |
`message` |
`message` |
`disconnect` |
`reconnect` |
`message` |
`message` |
`close`

Consuming (unhappy flow #1)

`error` (could be before or after receiving messages)

Consuming (unhappy flow #2)

`connect` |
`error` (could be before or after receiving messages) |
`message` |
`message` |
`message` |
`message` |
`disconnect` |
`reconnect` |
`message` |
`message` |
`close`

Publishing (happy flow)

`connect`

Publishing (unhappy flow)

`connect` |
`error`



## Error propagation

Consumer (Listen)
* When there is an error in creating the channel, the error will propagate to the `listen()` method.
* When there is an error in creating the connection and `maxTries` is set (to anything other than `-1`), the error will propagate to the `listen()` method.

Publish
* When there is an error in creating the channel, the error will propagate to the `publish()` method.
* When there is an error in creating the connection and `maxTries` is set (to anything other than `-1`), the error will propagate to the `publish()` method.


The library does __NOT__ emit a `close` event when the channel or connection is closed.
It __WILL__ emit a `disconnect` event. The library will automatically attempt to reconnect. It will emit a `reconnect` event once it has.

JIMJIM Adding text to trigger build JIMJIM


