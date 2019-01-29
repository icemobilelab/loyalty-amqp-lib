'use strict';

const logger = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].reduce((accumulator, item) => {
    accumulator[item] = function(message, ex) {
        // Do nothing
        // console.log(message, ex)
    };
    accumulator.child = function(obj, message) {
        return accumulator;
    };
    return accumulator;
}, {});

module.exports = logger;
