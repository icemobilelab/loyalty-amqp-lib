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


describe('base -- _getConnection()', () => {

    const _getConnection = AMQPBase.__get__('_getConnection');

    it('should return existing connection in base object', async function () {
        const existingConnection = new EventEmitter();
        const connection = await _getConnection({ _connection: existingConnection });
        expect(connection).to.deep.equal(existingConnection);
    });

    // it('should create new connection when recreate is true', async function () {
    //     const existingConnection = new EventEmitter();
    //     const connection = await _getConnection({ _connection: existingConnection }, true);
    //     expect(connection).to.not.deep.equal(existingConnection);
    // });

    it('should throw an error when recreate is false', async function () {
        try {
            const connection = await _getConnection({ _connection: null }, false);
        } catch (err) {
            expect(err.message).to.equal('no connection present, and not allowed to put in a new one');
        }
    });


});
