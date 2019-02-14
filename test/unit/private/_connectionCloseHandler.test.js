'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const sinon = require('sinon');
const mockLogger = require('../../util/mock-logger');


describe('_connectionCloseHandler', () => {

    const _connectionCloseHandler = AMQP.__get__('_connectionCloseHandler');
    const err = new Error('yikes');

    it('expect disconnect event to be emitted on base when error is passed', (done) => {
        const base = { emit: sinon.fake(), logger: mockLogger };
        _connectionCloseHandler(base, err);
        expect(base.emit.callCount).to.equal(1);
        expect(base.emit.getCall(0).args[0]).to.equal('disconnect');
        done();

    });

    it('expect to reconnect on close when error is passed', (done) => {
        const connectCallback = sinon.fake.resolves('mock-mock');
        AMQP.__set__('_connect', connectCallback);
        const lock = {
            readLock: function () {
                return Promise.resolve();
            }
        };
        const base = { emit: sinon.fake(), logger: mockLogger, lock };
        _connectionCloseHandler(base, err);
        expect(base.emit.callCount).to.equal(1);
        done();
    });

});