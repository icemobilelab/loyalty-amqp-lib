#!groovy

@Library('pipeline_library@master') _

import com.icemobile.jenkins.pipeline.lib.*

pipeline {
  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr:'3'))
    timeout(time: 1, unit: 'HOURS')
    ansiColor('xterm')
  }

  agent {
    label 'nodejs16'
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

          if (gitBranch != 'master') {
              // add short commit tag to the image tag
              serviceTag = serviceTag + "-" + gitCommit
          }

          delDCandSECRETS(projectName)
          // sets the service-tag.txt for the loyalty-ci-dashboard
          writeFile(file: 'service-tag.txt', text: serviceTag.trim())
          archiveArtifacts('service-tag.txt')

          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "integration-test", true);
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "unit-test", true);
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL + '/checkstyleResult', "lint", true);
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "static-code-analysis", true);
          setGithubStatus(projectName, GIT_COMMIT, BUILD_URL, "code-coverage-unit-test", true);
        }
      }
    }

    stage('Unit Tests') {
      steps {
        script {
            stageUnitTestAndLint(projectName, 60, gitBranch)
        }
      }
    }

    stage('Run Integration test') {
      steps {
        script {
          // Temporary - remove these and set in environment
          env.AMQP_HOST="loyalty-rabbitmq.loyalty-tst.svc"
          env.AMQP_USERNAME="icemobile1"
          env.AMQP_PASSWORD="bwNPOT8RXeBX"

          env.AMQP_QUEUE="libtest-queue"
          env.AMQP_EXCHANGE="libtest-exchange"
          env.AMQP_EXCHANGE_TYPE="topic"
          env.AMQP_ROUTE="libtest-route"
          env.LOG_LEVEL="error"

          IntegrationTestJS();
        }
      }
    }

    stage('Create Tag') {
        when {
            expression {
                return gitBranch == 'master'
            }
        }
        steps {
            script {
                setTag(projectVersion, gitCommit)
            }
        }
    }

    stage('Publish To Registry') {
      when {
        expression {
          return gitBranch == 'master'
        }
      }
      steps {
        script {
            if (projectVersion == gitTag) {
                echo 'No version change. Skip publishToNPM'
            } else {
                publishToNPM();
            }
        }
      }
    }

    stage('Slack Reporting') {
      when {
        expression {
          return gitBranch == 'master'
        }
      }
      steps {
        script {
          slackJenkins(projectVersion, gitCommit, projectName, gitBranch);
        }
      }
    }

  }
}
