'use strict';

/* global describe, it, before, after, beforeEach, afterEach */

const { expect } = require('chai');

const { sonarqube } = require('../../index');

function _sampleConfig() {
    return {
        serverUrl: 'http://sonarqube.example',
        token: 'testToken123',
        projectKey: 'exampleKey',
        projectVersion: '0.1.0'
    };
}

describe('SonarQube', () => {

    /* NOTE: The actual report function can not be invoked at the moment since we need a token for the user that
     * runs the report, and a) we don't have a deployed Sonarqube at the moment, b) the creation of a token requires
     * a manual process in the admin console, which can not be done using the SonarQube web API.
     *
     * See `test/sonarqube/sonarqube.js` and the tast `npm run sonarqube` in case you want to manually run the
     * SonarQube test.
     */

    it('Exports the report function', done => {

        expect(sonarqube).to.have.property('report').and.to.be.a('function');
        done();
    });

    it('Adds the login property to the options when provided', done => {
        const testConfig = _sampleConfig();
        testConfig.login = 'loginToken12';

        const config = sonarqube._buildConfig(testConfig);

        expect(config.options['sonar.login']).to.be.eql(testConfig.login);
        done();
    });

    it('options object does not contain login property if not provided.', done => {
        const testConfig = _sampleConfig();
        const config = sonarqube._buildConfig(testConfig);

        expect(config.options['sonar.login']).to.not.exist;
        done();
    });

    it('Adds the organization property to the options when provided', done => {
        const testConfig = _sampleConfig();
        testConfig.organization = 'exampleORG';

        const config = sonarqube._buildConfig(testConfig);

        expect(config.options['sonar.organization']).to.be.eql(testConfig.organization);
        done();
    });

    it('options object does not contain organization property if not provided.', done => {
        const testConfig = _sampleConfig();

        const config = sonarqube._buildConfig(testConfig);

        expect(config.options['sonar.organization']).to.not.exist;
        done();
    });
});
