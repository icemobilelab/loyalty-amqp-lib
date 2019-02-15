'use strict';

const { expect } = require('chai');
const Bluebird = require('bluebird');
const rewire = require('rewire');
const AMQP = rewire('../../../lib/amqp-base');
const config = require('../../config');
const constructor = require('../../util/constructor');

describe('_createConnection', () => {

    const base = new AMQP.AMQP(constructor(config));
    const _createConnection = AMQP.__get__('_createConnection');

    it('Successfully creates a connection', async () => {
        const resolve = AMQP.__set__('amqp.connect', () => {
            return Bluebird.resolve({ createChannel() {} });
        });
        after(resolve);

        const { host, username, password, logger, retry } = base;
        const connection = await _createConnection(host, username, password, logger, retry);
        expect(typeof connection.createChannel).to.equal('function');
    });

    it('Should proxy amqp.connect errors', async function () {
        const resolve = AMQP.__set__('amqp.connect', () => {
            const err = new Error();
            err.message = 'ACCESS_REFUSED';
            return Bluebird.reject(err);
        });
        after(resolve);

        const { host, password, logger } = base;
        const retry = { backoff: 0, interval: 25, maxTries: 2 };

        await _createConnection(host, 'invalidUser', password, logger, retry)
            .catch(err => {
                expect(err.message.includes('ACCESS_REFUSED')).to.equal(true);
            });
    });

    it('Should only reject after done retrying', async function () {
        this.timeout(5000);
        const startTime = new Date().getTime();
        const { host, password, logger } = base;
        const retry = { backoff: 0, interval: 125, maxTries: 20 };

        await _createConnection(host, 'invalidUser', password, logger, retry)
            .catch(
                () => {
                    expect(new Date().getTime() - startTime).to.be.greaterThan(2000);
                }
            );
    });



    // test retry by making sure it only rejects after an x-amount of time.

});