'use strict';
const consumer = require('./lib/amqp-consumer');
const publisher = require('./lib/amqp-publisher');

module.exports = {
    consumer,
    publisher
};