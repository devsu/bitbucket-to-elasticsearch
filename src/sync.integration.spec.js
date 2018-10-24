jest.unmock('client-oauth2');
const elasticsearch = require('elasticsearch');
const BitbucketSync = require('./sync');
const helper = require('../integration-tests/helper');
const statusEs = require('../integration-tests/status-es');

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
    await elastic.indices.create({'index': 'statuses'});
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
    test('should import repositories and commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const result1 = await elastic.count({'index': 'repositories'});
      const result2 = await elastic.count({'index': 'commits'});
      expect(result1.count).toBeGreaterThan(0);
      expect(result2.count).toBeGreaterThan(0);
    });

    test('should set firstSuccessfulBuildDate on corresponding commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const commit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '1febbaa7d468b127ad5a5c64c67b0cde2c41b264'});
      expect(commit._source.firstSuccessfulBuildDate).toEqual(statusEs.updated_on);
    });

    test('should not set firstSuccessfulBuildDate on other commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const commit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '6de4deee89aafee431b9382af5fce0f2b744c603'});
      expect(commit._source.firstSuccessfulBuildDate).toBeUndefined();
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

    test('should import statuses', async() => {
      const repoSlug = 'eslint-plugin-devsu';
      await bitbucketSync.synchronizeCommits(repoSlug);
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'statuses'});
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('synchronizeStatuses()', () => {
    test('should import statuses', async() => {
      const repoSlug = 'eslint-plugin-devsu';
      const node = 'e53e38697d5dd113f998594ac66eda8ebe1c663c';
      await bitbucketSync.synchronizeStatuses(repoSlug, node);
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'statuses'});
      expect(count).toBeGreaterThan(0);
    });
  });
});