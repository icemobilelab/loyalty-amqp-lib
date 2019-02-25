# Migration guide

When migrating from the AMQP library as present in the `loyalty-commons-v4` module to `loyalty-amqp-lib` there are a couple of things to be aware of;


## You cannot consume and publish on the same queue instance any more

– You need separate instances of AMQPConsumer and AMQPPublisher to do so.


## Publishing always happens through an exchange

– You can only publish messages to an exchange, and not directly to a queue.

Be careful when choosing names for an exchanges just for the sake of being able to publish. Naming collisions could mean trouble (e.g.; you could end up publishing messages to an existing exchange by mistake).


## Setting an exchange and route is required
– You always need to set a route and an exchange when creating an instance of a consumer or publisher.


## Consuming a dead letter queue (isDeadLetterConsumer)
– Passing in a deadLetterExchange name is required when creating a new consumer or publisher instance, but if you’d like to consume a deadletter queue, passing in a deadLetterExchange (which will then be asserted), makes little sense. You can therefore pass in a `true` value for the option `isDeadLetterConsumer’, which will not check if a deadLetterExchange is present in the constructor options.


## Acking and nacking a message
– Acking/nacking messages can be done when `options.noAck` is set to `false`. This can be done on the consumer instance using the methods `acknowledgeMessage` and `rejectMessage`. Note that you only need to pass in the data object.
