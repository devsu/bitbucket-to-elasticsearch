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
    const existsRepositories = await elastic.indices.exists({'index': 'repositories'});
    const existsCommits = await elastic.indices.exists({'index': 'commits'});
    expect(existsRepositories).toEqual(false);
    expect(existsCommits).toEqual(false);
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
  });

  describe('synchronizeRepositories()', () => {
    test('should import repositories', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'repositories'});
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