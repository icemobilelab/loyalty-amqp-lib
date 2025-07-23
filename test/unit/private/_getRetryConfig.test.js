import { expect } from 'chai';
import { _getRetryConfig } from '../../../lib/amqp-base.js';

describe('_getRetryConfig()', () => {
  it('When not passed, max_tries should be set to -1', function (done) {
    expect(_getRetryConfig().max_tries).to.equal(-1);
    done();
  });

  it('When passed, max_tries should be set to passed in value', function (done) {
    expect(_getRetryConfig({ maxTries: 9 }).max_tries).to.equal(9);
    done();
  });

  it('throw_original should be overridden to true', function (done) {
    expect(
      _getRetryConfig({ throw_original: false }).throw_original, // eslint-disable-line camelcase
    ).to.equal(true);
    done();
  });

  it('arbitrary passed in values should be merged', function (done) {
    const arbString = 'thisOne';
    expect(_getRetryConfig({ anyProperty: arbString }).anyProperty).to.equal(arbString);
    done();
  });
});
