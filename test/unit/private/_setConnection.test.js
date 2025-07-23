import { expect } from 'chai';
import { AMQP, _setConnection } from '../../../lib/amqp-base.js';
import config from '../../config.js';
import constructor from '../../util/constructor.js';

describe('_setConnection', () => {
  it('Successfully sets a connection', function () {
    this.timeout(2000);

    const testValue = 'test';
    const base = new AMQP(constructor(config));
    _setConnection(base, testValue);
    expect(base._connection).to.be.eql(testValue);
  });
  it('Successfully sets a connection to undefined', function () {
    this.timeout(2000);

    const testValue = undefined;
    const base = new AMQP(constructor(config));
    base._connection = 'incorrect_value';
    _setConnection(base, testValue);
    expect(base._connection).to.be.eql(testValue);
  });
});
