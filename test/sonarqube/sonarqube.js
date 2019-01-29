'use strict';

/*
 * Manually run the SonarQube report tool, used by the npm task "sonarqube".
 *
 * You can send the SonarQube reports to the server running on Azure DEV. Since the service is not publicly available,
 * you will have to redirect the port 9000 from the pod.
 *
 * In order to do so, first get the login command from
 * `https://master-dev-westeurope.bright-shopper.nl:8443/console/command-line`
 *
 * Then, run the following command:
 * ```
 * > oc project ci && oc port-forward $(oc get pods | grep -i "sonarqube" | awk '{print $1}') 9000:9000
 * ```
 *
 * And then you can run the following npm task, which is configured by default to send reports to
 * `http://localhost:9000`:
 *
 * ```
 * > npm run sonarqube
 * ```
 *
 * Go back to your browser, wait until the report is processed, and you shall see results in the dashboard.
 */

const { sonarqube } = require('../../index');
const pkg = require('../../package.json');

const SONARQUBE_URL = 'https://sonarcloud.io';
const SONARQUBE_TOKEN = '8b9ed53b71033ffdef53306df45ee9bf765d8741';

sonarqube.report({
    serverUrl: SONARQUBE_URL,
    token: SONARQUBE_TOKEN,
    organization: 'icemobilelab',
    projectKey: pkg.name,
    projectName: 'Loyalty Commons V4',
    projectVersion: pkg.version
}, () => {});
