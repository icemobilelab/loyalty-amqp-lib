#!groovy

@Library('jenkins-pipeline-library@master') _

import com.icemobile.jenkins.pipeline.lib.*

pipeline {
  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr:'3'))
    timeout(time: 1, unit: 'HOURS')
    ansiColor('xterm')
  }

  agent {
    label 'nodejs'
  }

  stages {

    stage('Initialize') {
      steps {
        script {
          gitBranch = getBranch()
          gitCommit = getCommit()
          gitTag = getTag()
          projectName = getBaseName()
          projectVersion = setProjectVersionType()
          serviceTag = setTagGlobal(gitBranch, projectVersion)
          delDCandSECRETS(projectName)
        }
      }
    }

   stage('Git Status Pending') {
    steps {
      script {
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "Code Quality", true);
        }
      }
    }

    stage('Run Unit Tests') {
      steps {
        script {
          unitTestJS();
        }
      }
    }

    stage('Run Integration test') {
      steps {
        script {
          // Temporary - remove these and set in environment
          env.AMQP_HOST="loyalty-rabbitmq.loyalty-dev.svc"
          env.AMQP_USERNAME="icemobile1"
          env.AMQP_PASSWORD="ve6i5JG005DqBIvP"

          env.AMQP_QUEUE="libtest-queue"
          env.AMQP_EXCHANGE="libtest-exchange"
          env.AMQP_EXCHANGE_TYPE="topic"
          env.AMQP_ROUTE="libtest-route"
          env.LOG_LEVEL="error"

          IntegrationTestJS();
        }
      }
    }

    stage('ESLint & Sonarcloud') {
     steps {
       script {
          CodeQualityChecks();
       }
     }
    }

    stage('Publish To Registry') {
      when {
        anyOf {
          expression { return gitBranch == 'master' }
          expression { return gitBranch == 'develop' }
        }
      }

      steps {
        script {
          publishToNPM();
        }
      }
    }

    stage('Git Status Quality Tests') {
      steps {
        script {
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "Code Quality");
        }
      }
    }
  }
}