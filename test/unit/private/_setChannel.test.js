import { expect } from 'chai';
import { AMQP, _setChannel } from '../../../lib/amqp-base.js';
import config from '../../config.js';
import constructor from '../../util/constructor.js';

describe('_setChannel', () => {
  it('Successfully sets a channel', function () {
    this.timeout(2000);

    const testValue = 'test';
    const base = new AMQP(constructor(config));
    _setChannel(base, testValue);
    expect(base._channel).to.be.eql(testValue);
  });
  it('Successfully sets a connection to undefined', function () {
    this.timeout(2000);

    const testValue = undefined;
    const base = new AMQP(constructor(config));
    base._channel = 'incorrect_value';
    _setChannel(base, testValue);
    expect(base._channel).to.be.eql(testValue);
  });
});
