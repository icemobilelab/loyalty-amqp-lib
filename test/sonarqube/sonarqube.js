import { sonarqube } from 'loyalty-commons-v4';
import config from '../config.js';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-commonjs
const pkg = require('../../package.json');
import got from 'got';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

sonarqube.report(
  {
    serverUrl: config.get('sonarqube.url'),
    token: config.get('sonarqube.token'),
    organization: config.get('sonarqube.organization'),
    projectKey: config.get('sonarqube.projectKey'),
    projectName: config.get('sonarqube.projectKey'),
    projectVersion: pkg.version,
  },
  () => {
    const taskReportPath = path.resolve(__dirname, '..', '..', '.scannerwork', 'report-task.txt');
    const taskReport = fs.readFileSync(taskReportPath, { encoding: 'utf-8' });

    // RegEx the task URL out of task report
    const taskUrl = /ceTaskUrl=(.*)/g.exec(taskReport)[1];

    const poller = setInterval(async () => {
      try {
        const taskResponse = await got(taskUrl, {
          auth: `${config.get('sonarqube.token')}:`,
          responseType: 'json',
        });
        const taskBody = taskResponse.body;

        if (taskBody.task && taskBody.task.status === 'SUCCESS') {
          const gateResponse = await got('https://sonarcloud.io/api/qualitygates/project_status', {
            responseType: 'json',
            auth: `${config.get('sonarqube.token')}:`,
            searchParams: {
              analysisId: taskBody.task.analysisId,
            },
          });
          const gateBody = gateResponse.body;

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
      } catch (error) {
        console.error('Error polling SonarQube task:', error.message);
        clearInterval(poller);
        process.exit(1);
      }
    }, 5000);
  },
);
