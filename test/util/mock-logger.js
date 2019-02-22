'use strict';

const logger = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].reduce((accumulator, item) => {
    accumulator[item] = console.log.bind({}, `[${item}]`); // function() {};
    accumulator.child = function() {
        return accumulator;
    };
    return accumulator;
}, {});

module.exports = logger;
