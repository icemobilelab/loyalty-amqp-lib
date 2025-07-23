import convict from 'convict';
import format from 'convict-format-with-validator';
convict.addFormats(format);

process.env.BLUEBIRD_DEBUG = 1;

const config = convict({
  log: {
    name: {
      doc: 'Log name',
      format: String,
      default: 'AMQP-lib-test',
      env: 'LOG_NAME',
    },
    level: {
      doc: 'Log level',
      format: String,
      default: 'trace',
      env: 'LOG_LEVEL',
    },
  },
  amqp: {
    host: {
      doc: 'The host of the RabbitMQ service.',
      format: String,
      default: 'localhost',
      env: 'AMQP_HOST',
    },
    username: {
      doc: 'A RabbitMQ username.',
      format: String,
      default: 'commons',
      env: 'AMQP_USERNAME',
    },
    password: {
      doc: 'Password for the RabbitMQ user.',
      format: String,
      default: 'commons',
      env: 'AMQP_PASSWORD',
    },
    retry: {
      maxTries: {
        doc: 'Maximum amount of times we will try to (re)connect to AMQP.',
        format: 'int',
        default: 5,
        env: 'AMQP_RETRY_MAX_TRIES',
      },
      interval: {
        doc: 'Initial wait time between attempts in milliseconds.',
        format: 'int',
        default: 100,
        env: 'AMQP_RETRY_INTERVAL',
      },
      backoff: {
        doc: 'Increase interval by this factor between attempts.',
        format: 'int',
        default: 2,
        env: 'AMQP_RETRY_BACKOFF',
      },
    },
    queue: {
      doc: 'AMQP Queue',
      format: String,
      default: 'QUEUE',
      env: 'AMQP_QUEUE',
    },
    exchange: {
      doc: 'AMQP Exchange',
      format: String,
      default: 'EXCHANGE',
      env: 'AMQP_EXCHANGE',
    },
    exchangeType: {
      doc: 'AMQP Exchange Type',
      format: String,
      default: 'topic',
      env: 'AMQP_EXCHANGE_TYPE',
    },
    route: {
      doc: 'AMQP Route',
      format: String,
      default: 'ROUTE',
      env: 'AMQP_ROUTE',
    },
  },
  sonarqube: {
    url: {
      doc: 'URL of the SonarQube server',
      format: 'url',
      default: 'https://sonarcloud.io',
      env: 'SONARQUBE_URL',
    },
    token: {
      doc: 'SonarQube token',
      format: String,
      default: 'faf488ec16ef628f2bc8573818384f337de91cd0',
      env: 'SONARQUBE_TOKEN',
    },
    projectKey: {
      doc: 'The SonarQube Project Key',
      format: String,
      default: 'loyalty-amqp-lib',
      env: 'SONARQUBE_PROJECT_KEY',
    },
    organization: {
      doc: 'The organization key',
      format: String,
      default: 'icemobilelab',
      env: 'SONARQUBE_ORG',
    },
  },
});

export default config;
