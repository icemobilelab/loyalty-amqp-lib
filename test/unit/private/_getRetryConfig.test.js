'use strict';

const { expect } = require('chai');
const rewire = require('rewire');
const AMQPBase = rewire('../../lib/amqp-base');
const { EventEmitter } = require('events');


describe('base -- getRetryConfig()', () => {

    const getRetryConfig = AMQPBase.__get__('getRetryConfig');

    it('When not passed, max_tries should be set to -1', function (done) {
        expect(getRetryConfig().max_tries).to.equal(-1);
        done();
    });

    it('When passed, max_tries should be set to passed in value', function (done) {
        expect(getRetryConfig({ max_tries: 9 }).max_tries).to.equal(9); // eslint-disable-line camelcase
        done();
    });

    it('throw_original should be overridden to true', function (done) {
        expect(getRetryConfig({ throw_original: false }).throw_original).to.equal(true); // eslint-disable-line camelcase
        done();
    });

    it('arbitrary passed in values should be merged', function (done) {
        const arbString = 'thisOne';
        expect(getRetryConfig({ anyProperty: arbString }).anyProperty).to.equal(arbString); // eslint-disable-line camelcase
        done();
    });

});