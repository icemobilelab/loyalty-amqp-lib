## Versioning
Given a version number MAJOR.MINOR.PATCH, increment the:

* MAJOR version when you make incompatible API changes
* MINOR version when you add functionality in a backwards-compatible manner
* PATCH version when you make backwards-compatible bug fixes
* Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format.

The versioning rules are described on http://semver.org/

## Loyalty AMQP Library Changelog

### 3.0.0
* migrated to a module type
* migrate queue to quorum type

### 2.1.0
* Brought back the `.queue` suffix for dead letter queues, as it existed in the old commons amqp library

### 2.0.0
* [SHIP-10412](https://icemobile.atlassian.net/browse/SHIP-10412):
  * Updated to Node.js 16
  * Updated dependencies
  * Removed Bluebird
  * Replaced `bluebird-retry` with `p-retry`

### 1.5.0
* Fix AMQP connection resiliency

  When connections were forcibly closed (something that can be done both
  from the RabbitMQ management UI and with `rabbitmqctl`), Consumers and
  Producers would error out and never reconnect. These changes basically
  impose a persistent reconnect cycle, except when a connection is
  manually closed by the client.

### 1.4.2
* Try to disconnect if there is no data to be consumed.

### 1.4.1
* [PITEAM-17](https://icemobile.atlassian.net/browse/PITEAM-17): Remove icemobilelab-ci GitHub Application Token and support personal Github token.

### 1.4.0
* Added feature to supply headers to a publish / publishToQueue

### 1.3.0
* Added possibility to publish directly to a queue

### 1.2.0
* Change argument from 'noAck' to 'ackMsgs' (flip the bool)

### 1.1.1
* Bugfixes for ack/nack functionality

### 1.1.0
* Add ack/nack functionality

### 1.0.3
* Set default type for exchanges to 'topic'

### 1.0.2
* Simplify variable names

### 1.0.1
* Published to NPM

### 1.0.0
* Initial Release

### 0.0.1
* Add starting codebase (v1 lib) and commit package-lock.json

### 0.0.0
* Initial Commit
