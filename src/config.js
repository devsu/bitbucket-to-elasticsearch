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

const env = process.env;

module.exports = Object.assign({
  'bitbucket': {
    'username': env.BB2ES_BITBUCKET_USERNAME,
    'clientId': env.BB2ES_BITBUCKET_CLIENT_ID,
    'clientSecret': env.BB2ES_BITBUCKET_CLIENT_SECRET,
    'defaultTimeout': env.BB2ES_BITBUCKET_DEFAULT_TIMEOUT ? parseInt(env.BB2ES_BITBUCKET_DEFAULT_TIMEOUT, 10) : 10000,
    'queueOptions': {
      'processRepo': {
        'concurrency': env.BB2ES_BITBUCKET_QUEUES_PROCESS_REPO_CONCURRENCY ? parseInt(env.BB2ES_BITBUCKET_QUEUES_PROCESS_REPO_CONCURRENCY, 10) : 2,
      },
      'commits': {
        // From the documentation, the limit for this endpoint is 1000 / hour.
        // To configure such limit you should set
        // intervalCap = 1000, interval = 3600000
        // Not setting value by default, since the script automatically stops when no more data can be processed
        // and you can restart it later, and it will start updating only missing data.
        'intervalCap': env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL_CAP ? parseInt(env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL_CAP, 10) : undefined,
        'interval': env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL ? parseInt(env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL, 10) : undefined,
        'concurrency': env.BB2ES_BITBUCKET_QUEUES_COMMITS_CONCURRENCY ? parseInt(env.BB2ES_BITBUCKET_QUEUES_COMMITS_CONCURRENCY, 10) : 5,
      },
      'statuses': {
        // It's a high number, because we have to make one request per commit, so we need to make a lot of requests
        // From what I see in the Bitbucket API limits, this endpoint does not have a limit defined
        // (Haven't verified though)
        'concurrency': env.BB2ES_BITBUCKET_QUEUES_STATUSES_CONCURRENCY ? parseInt(env.BB2ES_BITBUCKET_QUEUES_STATUSES_CONCURRENCY, 10) : 50,
      },
      'refs': {
        'concurrency': env.BB2ES_BITBUCKET_QUEUES_REFS_CONCURRENCY ? parseInt(env.BB2ES_BITBUCKET_QUEUES_REFS_CONCURRENCY, 10) : 5,
      },
    }
  },
  'elasticsearch': {
    'host': env.BB2ES_ELASTICSEARCH_HOST || '127.0.0.1:9200',
  },
  'analytics': {
    // we assume that the tags that match this pattern were deployed (used to calculate firstSuccessfulDeploymentDate)
    'deploymentTagsPattern': env.BB2ES_ANALYTICS_DEPLOYMENT_TAGS_PATTERN || 'v.+',
  },
}, configJson);