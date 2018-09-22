jest.unmock('client-oauth2');
const elasticsearch = require('elasticsearch');
const BitbucketSync = require('./sync');
const helper = require('../integration-tests/helper');

describe('BitbucketSync integration tests', () => {
  let elastic, elasticConfig, bitbucketSync, config;

  beforeAll(async() => {
    jest.setTimeout(20000);
    const host = await helper.getHost();
    const port = await helper.getExternalPort('elasticsearch', 9200);
    elasticConfig = {
      'host': `${host}:${port}`,
    };
    elastic = new elasticsearch.Client(Object.assign({}, elasticConfig));
  });

  beforeEach(async() => {
    config = {
      'bitbucket': {
        'username': 'devsu',
      },
      'elasticsearch': elasticConfig,
    };
    bitbucketSync = new BitbucketSync(config);
    await elastic.indices.delete({'index': '_all'});
    await elastic.indices.flush({'waitIfOngoing': true});
    await elastic.indices.create({'index': 'repositories'});
    await elastic.indices.create({'index': 'commits'});
    await elastic.indices.flush({'waitIfOngoing': true});
  });

  describe('execute()', () => {
    describe('when the repositories index does not exist', () => {
      test('should create the repositories index', async() => {
        await bitbucketSync.execute();
        await elastic.indices.flush({'waitIfOngoing': true});
        await elastic.indices.refresh();
        const exists = await elastic.indices.exists({'index': 'repositories'});
        expect(exists).toEqual(true);
      });
    });

    // TODO: These tests might be improved
    test('should import repositories and their commits', async() => {
      await bitbucketSync.execute();
      await elastic.indices.flush({'waitIfOngoing': true});
      await elastic.indices.refresh();
      const result1 = await elastic.count({'index': 'repositories'});
      const result2 = await elastic.count({'index': 'commits'});
      expect(result1.count).toBeGreaterThan(0);
      expect(result2.count).toBeGreaterThan(0);
    });

    test('should not reimport existing content', async() => {
      await bitbucketSync.execute();
      await elastic.indices.refresh();
      await bitbucketSync.execute();
    });
  });

  describe('synchronizeRepositories()', () => {
    test('should import repositories', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'repositories'});
      expect(count).toBeGreaterThan(0);
    });

    test('should import commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'commits'});
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('synchronizeCommits()', () => {
    test('should import commits', async() => {
      const repoSlug = 'eslint-plugin-devsu';
      await bitbucketSync.synchronizeCommits(repoSlug);
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'commits'});
      expect(count).toBeGreaterThan(0);
    });
  });
});