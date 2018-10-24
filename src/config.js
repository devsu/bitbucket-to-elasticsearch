const path = require('path');
const logger = require('./logger');
const log = logger.child({'class': 'Config'});

let configJson = {};
try {
  configJson = require(path.join(process.cwd(), 'config.json'));
  log.info('config.json found')
} catch(e) {
  log.info('config.json could not be loaded. Using environment variables.');
}

module.exports = Object.assign({
  'bitbucket': {
    'username': process.env.BB2ES_BITBUCKET_USERNAME,
    'clientId': process.env.BB2ES_BITBUCKET_CLIENT_ID,
    'clientSecret': process.env.BB2ES_BITBUCKET_CLIENT_SECRET,
    'defaultTimeout': process.env.BB2ES_BITBUCKET_DEFAULT_TIMEOUT || 10000,
    'queueOptions': {
      'processRepo': {
        'concurrency': process.env.BB2ES_BITBUCKET_QUEUES_PROCESS_REPO_CONCURRENCY || 2,
      },
      'commits': {
        // From the documentation, the limit for this endpoint is 1000 / hour.
        // To configure such limit you should set
        // intervalCap = 1000, interval = 3600000
        // Not setting value by default, since the script automatically stops when no more data can be processed
        // and you can restart it later, and it will start updating only missing data.
        'intervalCap': process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL_CAP,
        'interval': process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL,
        'concurrency': process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_CONCURRENCY || 5,
      },
      'statuses': {
        // It's a high number, because we have to make one request per commit, so we need to make a lot of requests
        // From what I see in the Bitbucket API limits, this endpoint does not have a limit defined
        // (Haven't verified though)
        'concurrency': process.env.BB2ES_BITBUCKET_QUEUES_STATUSES_CONCURRENCY || 50,
      },
      'refs': {
        'concurrency': process.env.BB2ES_BITBUCKET_QUEUES_REFS_CONCURRENCY || 5,
      },
    }
  },
  'elasticsearch': {
    'host': process.env.BB2ES_ELASTICSEARCH_HOST || '127.0.0.1:9200',
  },
  'analytics': {
    // we assume that the tags that match this pattern were deployed (used to calculate firstSuccessfulDeploymentDate)
    'deploymentTagsPattern': process.env.BB2ES_ANALYTICS_DEPLOYMENT_TAGS_PATTERN || 'v.+',
  },
}, configJson);