import { expect } from 'chai';
import { _mapBluebirdRetryOptionsToPRetryOptions } from '../../../lib/amqp-base.js';

describe('_mapBluebirdRetryOptionsToPRetryOptions()', () => {
  it('defaults should match `bluebird-retry` defaults', () => {
    const pRetryOptions = _mapBluebirdRetryOptionsToPRetryOptions({});
    expect(pRetryOptions).to.deep.equal({
      minTimeout: 1000,
      maxTimeout: Infinity,
      factor: 1,
      retries: 4,
    });
  });

  it('should map `bluebird-retry` options to `p-retry` options', () => {
    const pRetryOptions = _mapBluebirdRetryOptionsToPRetryOptions({
      interval: 256,
      max_interval: 512, // eslint-disable-line camelcase
      backoff: 3,
      max_tries: 8, // eslint-disable-line camelcase
    });
    expect(pRetryOptions).to.deep.equal({
      minTimeout: 256,
      maxTimeout: 512,
      factor: 3,
      retries: 7,
    });
  });

  it('should set retries to one less than max_tries', () => {
    const pRetryOptions = _mapBluebirdRetryOptionsToPRetryOptions({
      max_tries: 10, // eslint-disable-line camelcase
    });
    expect(pRetryOptions.retries).to.equal(9);
  });

  it('should run forever when max_tries is -1', () => {
    const pRetryOptions = _mapBluebirdRetryOptionsToPRetryOptions({
      max_tries: -1, // eslint-disable-line camelcase
    });
    expect(pRetryOptions.retries).to.equal(4);
    expect(pRetryOptions.forever).to.be.true;
  });
});
