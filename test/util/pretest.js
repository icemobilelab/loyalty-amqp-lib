process.on('unhandledRejection', (error) => {
  console.log('📍', error.message); //eslint-disable-line no-console
});
