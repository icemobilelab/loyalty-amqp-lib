# Migration guide

When migrating from the AMQP library as present in the `loyalty-commons-v4` module to `loyalty-amqp-lib` there are a couple of things to be aware of;


## You cannot consume and publish on the same queue instance any more

– You need an instance of AMQPConsumer to consume and a separate instance of AMQPPublisher to publish.


## Publishing always happens through an exchange

– You can only publish messages to an exchange, and not directly to a queue.

Be careful when choosing names for an exchanges just for the sake of being able to publish. Naming collisions could mean trouble (e.g.; you could end up publishing messages to an existing exchange by mistake).


## Setting an exchange and route is required
– You always need to set a route and an exchange when creating an instance of a consumer or publisher.

If you fail to pass a required argument, the constructor will throw an error.


## Consuming a dead letter queue (`isDeadLetterConsumer`)
– Passing in a name for `deadLetterExchange` is required when creating a new consumer or publisher instance, but if you’d like to consume a deadletter queue, passing in a `deadLetterExchange` (which will then be asserted), makes little sense. You can therefore pass in a `true` value for the option `isDeadLetterConsumer`, which will not check if a `deadLetterExchange` is present in the constructor options.


## Acking or nacking a message
– (N)acking messages can be done when `options.ackMsgs` is set to `true`. Acknowledgement can be done on the consumer instance using the methods `acknowledgeMessage` and `rejectMessage`.

Note that you only need to pass in the data object that represents the message being acknowledged. This data object can be retrieved by listening to the `message` event on the consumer. When this event is called, it receives two (2) arguments; a `string` representing just the message, and and `object` representing the whole data object. This second argument is required for (n)acking.
