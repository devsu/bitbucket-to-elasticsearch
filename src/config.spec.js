describe('config', () => {
  let config;

  describe('without env variables', () => {
    beforeEach(() => {
      config = require('./config');
    });

    test('should return default values', () => {
      expect(config).toEqual(expect.objectContaining({
        'bitbucket': {
          'username': expect.any(String),
          "clientId": expect.any(String),
          "clientSecret": expect.any(String),
          'defaultTimeout': expect.any(Number),
          'queueOptions': {
            'processRepo': {
              'concurrency': expect.any(Number),
            },
            'commits': {
              'concurrency': expect.any(Number),
            },
            'statuses': {
              'concurrency': expect.any(Number),
            },
            'refs': {
              'concurrency': expect.any(Number),
            },
          }
        },
        'elasticsearch': {
          'host': expect.any(String),
        },
        'analytics': {
          'deploymentTagsPattern': expect.any(String),
        },
      }));
    });
  });

  describe('with env variables', () => {
    let initialEnv;

    beforeEach(() => {
      initialEnv = process.env;
      process.env.BB2ES_BITBUCKET_USERNAME = 'devsu';
      process.env.BB2ES_BITBUCKET_CLIENT_ID = 'my-id';
      process.env.BB2ES_BITBUCKET_CLIENT_SECRET = 'my-secret';
      process.env.BB2ES_BITBUCKET_DEFAULT_TIMEOUT = '20000';
      process.env.BB2ES_BITBUCKET_QUEUES_PROCESS_REPO_CONCURRENCY = '11';
      process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL_CAP = '22';
      process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_INTERVAL = '33';
      process.env.BB2ES_BITBUCKET_QUEUES_COMMITS_CONCURRENCY = '44';
      process.env.BB2ES_BITBUCKET_QUEUES_STATUSES_CONCURRENCY = '55';
      process.env.BB2ES_BITBUCKET_QUEUES_REFS_CONCURRENCY = '66';
      process.env.BB2ES_ELASTICSEARCH_HOST = '192.168.1.1:9200';
      process.env.BB2ES_ANALYTICS_DEPLOYMENT_TAGS_PATTERN = 'whatever';
      jest.resetModules();
      config = require('./config');
    });

    afterEach(() => {
      process.env = initialEnv;
      jest.resetModules();
    });

    test('should return env variables values', () => {
      expect(config).toEqual(expect.objectContaining({
        'bitbucket': {
          'username': 'devsu',
          'clientId': 'my-id',
          'clientSecret': 'my-secret',
          'defaultTimeout': 20000,
          'queueOptions': {
            'processRepo': {
              'concurrency': 11,
            },
            'commits': {
              'intervalCap': 22,
              'interval': 33,
              'concurrency': 44,
            },
            'statuses': {
              'concurrency': 55,
            },
            'refs': {
              'concurrency': 66,
            },
          }
        },
        'elasticsearch': {
          'host': '192.168.1.1:9200',
        },
        'analytics': {
          'deploymentTagsPattern': 'whatever',
        },
      }));
    });
  });
});
