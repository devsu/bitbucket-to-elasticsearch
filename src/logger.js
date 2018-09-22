const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  'name': 'bitbucket-to-elasticsearch'
});

module.exports = logger;