const logger = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].reduce((accumulator, item) => {
  accumulator[item] = () => {}; // console.log.bind({}, `[${item}]`);
  accumulator.child = () => {
    return accumulator;
  };
  return accumulator;
}, {});

export default logger;
