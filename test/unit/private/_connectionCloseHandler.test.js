import { expect } from 'chai';
import sinon from 'sinon';
import { _connectionCloseHandler } from '../../../lib/amqp-base.js';
import mockLogger from '../../util/mock-logger.js';

describe('_connectionCloseHandler', () => {
  const err = new Error('test error');

  it('expect disconnect event to be emitted on base when error is passed', (done) => {
    const base = { emit: sinon.fake(), logger: mockLogger };
    _connectionCloseHandler(base, err);
    expect(base.emit.callCount).to.equal(1);
    expect(base.emit.getCall(0).args[0]).to.equal('disconnect');
    done();
  });

  it('expect to reconnect on close when error is passed', (done) => {
    const lock = {
      readLock: function () {
        return Promise.resolve();
      },
    };
    const base = { emit: sinon.fake(), logger: mockLogger, lock };
    _connectionCloseHandler(base, err);
    expect(base.emit.callCount).to.equal(1);
    done();
  });
});
