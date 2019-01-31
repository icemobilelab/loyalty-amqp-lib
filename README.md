# loyalty-amqp-lib
Common library for connecting to RabbitMQ


The library does NOT emit a close even when the channel or connection is closed.
The library will automatically attempt to reconnect & emit a 'reconnect' event when successful.