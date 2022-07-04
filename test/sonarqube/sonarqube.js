'use strict';

const { sonarqube } = require('loyalty-commons-v4');

const config = require('../config');
const pkg = require('../../package.json');
const fs = require('fs');
const request = require('request-promise-native');
const path = require('path');

sonarqube.report({
    serverUrl: config.get('sonarqube.url'),
    token: config.get('sonarqube.token'),
    organization: config.get('sonarqube.organization'),
    projectKey: config.get('sonarqube.projectKey'),
    projectName: config.get('sonarqube.projectKey'),
    projectVersion: pkg.version
}, () => {
    const taskReportPath = path.resolve(__dirname, '..', '..', '.scannerwork', 'report-task.txt');
    const taskReport = fs.readFileSync(taskReportPath, {encoding: 'utf-8'});

    // RegEx the task URL out of task report
    const taskUrl = /ceTaskUrl=(.*)/g.exec(taskReport)[1];

    const poller = setInterval(async () => {
        const taskBody = await request(taskUrl, {
            auth: { user: config.get('sonarqube.token') },
            json: true
        });

        if (taskBody.task && taskBody.task.status === 'SUCCESS') {
            const gateBody = await request('https://sonarcloud.io/api/qualitygates/project_status',
                {
                    json: true,
                    auth: { user: config.get('sonarqube.token') },
                    qs: {
                        analysisId: taskBody.task.analysisId
                    }
                });

            if (gateBody.projectStatus && gateBody.projectStatus.status) {
                if (gateBody.projectStatus.status === 'ERROR') {
                    console.log('Sonarcloud.io returned that quality gates failed:'); // eslint-disable-line
                    console.dir(gateBody.projectStatus.conditions, null, 4); // eslint-disable-line
                    process.exit(1); // error out
                }
                console.log('Sonarcloud.io returned that quality gates did not fail:'); // eslint-disable-line
                console.dir(gateBody.projectStatus.conditions, null, 4); // eslint-disable-line
                clearInterval(poller);
            }
        }
    }, 5000);

});
