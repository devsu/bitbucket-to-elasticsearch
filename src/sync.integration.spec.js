jest.unmock('client-oauth2');
const elasticsearch = require('elasticsearch');
const BitbucketSync = require('./sync');
const helper = require('../integration-tests/helper');
const statusData = require('../integration-tests/status-es');
const repositoryData = require('../integration-tests/repository-es');
const commitData = require('../integration-tests/commit-es');
const Database = require('./database');
const config = require('./config');

describe('BitbucketSync integration tests', () => {
  let elastic, database, elasticConfig, bitbucketSync;

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
    config.bitbucket.username = 'devsu';
    config.elasticsearch = elasticConfig;
    bitbucketSync = new BitbucketSync(config);
    database = new Database(elasticConfig);
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
    test('should import repositories, commits and refs', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const result1 = await elastic.count({'index': 'repositories'});
      const result2 = await elastic.count({'index': 'commits'});
      const result3 = await elastic.count({'index': 'refs'});
      expect(result1.count).toBeGreaterThan(0);
      expect(result2.count).toBeGreaterThan(0);
      expect(result3.count).toBeGreaterThan(0);
    });

    test('should set firstSuccessfulBuildDate on corresponding commits, but not on other commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const commit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '1febbaa7d468b127ad5a5c64c67b0cde2c41b264'});
      expect(commit._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      const anotherCommit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '6de4deee89aafee431b9382af5fce0f2b744c603'});
      expect(anotherCommit._source.firstSuccessfulBuildDate).toBeUndefined();
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

  describe('synchronizeRefs()', () => {
    test('should import refs', async() => {
      const repoSlug = 'eslint-plugin-devsu';
      await bitbucketSync.synchronizeRefs(repoSlug);
      await elastic.indices.refresh();
      const {count} = await elastic.count({'index': 'refs'});
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('getOutdatedRepositories()', () => {
    describe('when the repo exists but its outdated', () => {
      beforeEach(async() => {
        const outdatedDate = new Date(2001, 1, 1).toISOString();
        const repo = Object.assign({}, repositoryData, {'updated_on': outdatedDate});
        await elastic.indices.flush({'waitIfOngoing': true});
        await database.saveRepositories([repo]);
      });

      test('should return the repo', async() => {
        const actual = await bitbucketSync.getOutdatedRepositories();
        expect(actual.length).toBeGreaterThanOrEqual(1);
        const found = actual.find((repo) => repo.uuid === repositoryData.uuid);
        expect(found).toBeDefined();
      });
    });

    describe('when the repo exists but its updated', () => {
      beforeEach(async() => {
        const nowAsIsoTime = new Date().toISOString();
        const repo = Object.assign({}, repositoryData, {'updated_on': nowAsIsoTime});
        await elastic.indices.flush({'waitIfOngoing': true});
        await database.saveRepositories([repo]);
      });

      test('should not return the repo', async() => {
        const actual = await bitbucketSync.getOutdatedRepositories();
        const found = actual.find((repo) => repo.uuid === repositoryData.uuid);
        expect(found).toBeUndefined();
      });
    });

    describe('when the repo does not exists', () => {
      test('should return the repo', async() => {
        const actual = await bitbucketSync.getOutdatedRepositories();
        expect(actual.length).toBeGreaterThanOrEqual(1);
        const found = actual.find((repo) => repo.uuid === repositoryData.uuid);
        expect(found).toBeDefined();
      });
    });
  });

  describe('updateFirstSuccessfulBuildDate()', () => {
    let oldIsoDate;

    beforeEach(async() => {
      oldIsoDate = new Date(2010,1,1).toISOString();
      const a = Object.assign({}, commitData, {'hash': 'a', 'parents':['b']});
      const b = Object.assign({}, commitData, {'hash': 'b', 'parents':['c', 'd']});
      const c = Object.assign({}, commitData, {'hash': 'c', 'parents':['e']});
      const d = Object.assign({}, commitData, {'hash': 'd', 'parents':['e'], 'firstSuccessfulBuildDate': oldIsoDate});
      const e = Object.assign({}, commitData, {'hash': 'e', 'parents':['f'], 'firstSuccessfulBuildDate': oldIsoDate});
      const f = Object.assign({}, commitData, {'hash': 'f', 'parents':[], 'firstSuccessfulBuildDate': oldIsoDate});
      const g = Object.assign({}, commitData, {'hash': 'g', 'parents':['f']});
      const status = Object.assign({}, statusData);
      status.commit.hash = 'a';
      await elastic.indices.flush({'waitIfOngoing': true});
      await Promise.all([
        database.saveCommits([a, b, c, d, e, f, g]),
        database.saveStatuses([status]),
        database.saveRepositories([repositoryData]),
      ]);
    });

    test('should set firstSuccessfulBuildDate on corresponding commits, but not on other commits', async() => {
      await bitbucketSync.updateFirstSuccessfulBuildDate(repositoryData.uuid);
      await elastic.indices.refresh();
      const commitA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
      const commitB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
      const commitC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
      const commitD = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'd'});
      const commitE = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'e'});
      const commitF = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'f'});
      const commitG = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'g'});
      expect(commitA._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      expect(commitB._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      expect(commitC._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      expect(commitD._source.firstSuccessfulBuildDate).toEqual(oldIsoDate);
      expect(commitE._source.firstSuccessfulBuildDate).toEqual(oldIsoDate);
      expect(commitF._source.firstSuccessfulBuildDate).toEqual(oldIsoDate);
      expect(commitG._source.firstSuccessfulBuildDate).toBeUndefined();
    });

    describe('firstSuccessfulBuildDate hasnt been previously set on repo', () => {
      test('should set firstSuccessfulBuildDate on repo', async() => {
        await bitbucketSync.updateFirstSuccessfulBuildDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
        expect(repo._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      });
    });

    describe('firstSuccessfulBuildDate already set on repo', () => {
      let oldIsoDate;

      beforeEach(async() => {
        oldIsoDate = new Date(2001,1,1).toISOString();
        const updatedRepo = Object.assign({}, repositoryData, {'firstSuccessfulBuildDate': oldIsoDate});
        await database.saveRepositories([updatedRepo]);
      });

      test('should not change it', async() => {
        await bitbucketSync.updateFirstSuccessfulBuildDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
        expect(repo._source.firstSuccessfulBuildDate).toEqual(oldIsoDate);
      });
    });
  });
});