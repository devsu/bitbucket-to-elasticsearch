jest.unmock('client-oauth2');
const _ = require('lodash');
const elasticsearch = require('elasticsearch');
const BitbucketSync = require('./sync');
const helper = require('../integration-tests/helper');
const statusData = require('../integration-tests/status-es');
const repositoryData = require('../integration-tests/repository-es');
const commitData = require('../integration-tests/commit-es');
const refBranchData = require('../integration-tests/ref-branch-es');
const refTagData = require('../integration-tests/ref-tag-es');
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
    delete config.bitbucket.clientId;
    delete config.bitbucket.clientSecret;
    config.elasticsearch = elasticConfig;
    config.analytics.deploymentTagsPattern = 'v.+';
    bitbucketSync = new BitbucketSync(config);
    database = new Database(elasticConfig);
    await elastic.indices.delete({'index': '_all'});
    await elastic.indices.flush({'waitIfOngoing': true});
    await elastic.indices.create({'index': 'repositories'});
    await elastic.indices.create({'index': 'commits'});
    await elastic.indices.create({'index': 'statuses'});
    await elastic.indices.create({'index': 'deployments'});
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
    test('should import repositories, commits, refs and deployments', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const result1 = await elastic.count({'index': 'repositories'});
      const result2 = await elastic.count({'index': 'commits'});
      const result3 = await elastic.count({'index': 'refs'});
      const result4 = await elastic.count({'index': 'deployments'});
      expect(result1.count).toBeGreaterThan(0);
      expect(result2.count).toBeGreaterThan(0);
      expect(result3.count).toBeGreaterThan(0);
      expect(result4.count).toBeGreaterThan(0);
    });

    test('should set firstSuccessfulBuildDate on corresponding commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const commit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '1febbaa7d468b127ad5a5c64c67b0cde2c41b264'});
      expect(commit._source.firstSuccessfulBuildDate).toEqual(statusData.updated_on);
      const anotherCommit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '6de4deee89aafee431b9382af5fce0f2b744c603'});
      expect(anotherCommit._source.firstSuccessfulBuildDate).toBeUndefined();
    });

    test('should set firstSuccessfulDeploymentDate on corresponding commits', async() => {
      await bitbucketSync.synchronizeRepositories();
      await elastic.indices.refresh();
      const commit = await elastic.get({'index': 'commits', 'type': 'commit', 'id': '6de4deee89aafee431b9382af5fce0f2b744c603'});
      expect(commit._source.firstSuccessfulDeploymentDate).toEqual(refTagData.date);
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
      const a = Object.assign(_.cloneDeep(commitData), {'hash': 'a', 'parents':['b']});
      const b = Object.assign(_.cloneDeep(commitData), {'hash': 'b', 'parents':['c', 'd']});
      const c = Object.assign(_.cloneDeep(commitData), {'hash': 'c', 'parents':['e']});
      const d = Object.assign(_.cloneDeep(commitData), {'hash': 'd', 'parents':['e'], 'firstSuccessfulBuildDate': oldIsoDate});
      const e = Object.assign(_.cloneDeep(commitData), {'hash': 'e', 'parents':['f'], 'firstSuccessfulBuildDate': oldIsoDate});
      const f = Object.assign(_.cloneDeep(commitData), {'hash': 'f', 'parents':[], 'firstSuccessfulBuildDate': oldIsoDate});
      const g = Object.assign(_.cloneDeep(commitData), {'hash': 'g', 'parents':['f']});
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

  describe('updateFirstSuccessfulDeploymentDate()', () => {
    let oldIsoDate;

    beforeEach(async() => {
      oldIsoDate = new Date(2010,1,1).toISOString();
      const a = Object.assign(_.cloneDeep(commitData), {'hash': 'a', 'parents':['b']});
      const b = Object.assign(_.cloneDeep(commitData), {'hash': 'b', 'parents':['c', 'd']});
      const c = Object.assign(_.cloneDeep(commitData), {'hash': 'c', 'parents':['e']});
      const d = Object.assign(_.cloneDeep(commitData), {'hash': 'd', 'parents':['e'], 'firstSuccessfulDeploymentDate': oldIsoDate});
      const e = Object.assign(_.cloneDeep(commitData), {'hash': 'e', 'parents':['f'], 'firstSuccessfulDeploymentDate': oldIsoDate});
      const f = Object.assign(_.cloneDeep(commitData), {'hash': 'f', 'parents':[], 'firstSuccessfulDeploymentDate': oldIsoDate});
      const g = Object.assign(_.cloneDeep(commitData), {'hash': 'g', 'parents':['f']});
      await elastic.indices.flush({'waitIfOngoing': true});
      await Promise.all([
        database.saveCommits([a, b, c, d, e, f, g]),
        database.saveRepositories([repositoryData]),
      ]);
    });

    describe('when ref name matches with deployment tag name regex', () => {
      beforeEach(async() => {
        const ref1 = Object.assign(_.cloneDeep(refBranchData), {'id': 'ref1'});
        const ref2 = Object.assign(_.cloneDeep(refTagData), {'id': 'ref2'});
        ref1.target.hash = 'a';
        ref2.target.hash = 'a';
        ref2.name = 'v0.0.1';
        await database.saveRefs([ref1, ref2]);
      });

      test('should save a new deployment', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const deployments = await elastic.count({'index': 'deployments'});
        expect(deployments.count).toBeGreaterThan(0)
      });

      test('should set firstSuccessfulDeploymentDate on corresponding commits, but not on other commits', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const commitA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
        const commitB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
        const commitC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
        const commitD = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'd'});
        const commitE = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'e'});
        const commitF = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'f'});
        const commitG = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'g'});
        expect(commitA._source.firstSuccessfulDeploymentDate).toEqual(refTagData.date);
        expect(commitB._source.firstSuccessfulDeploymentDate).toEqual(refTagData.date);
        expect(commitC._source.firstSuccessfulDeploymentDate).toEqual(refTagData.date);
        expect(commitD._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitE._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitF._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitG._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });

      describe('firstSuccessfulDeploymentDate hasnt been previously set on repo', () => {
        test('should set firstSuccessfulDeploymentDate on repo', async() => {
          await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
          await elastic.indices.refresh();
          const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
          expect(repo._source.firstSuccessfulDeploymentDate).toEqual(refTagData.date);
        });
      });

      describe('firstSuccessfulDeploymentDate already set on repo', () => {
        let oldIsoDate;

        beforeEach(async() => {
          oldIsoDate = new Date(2001,1,1).toISOString();
          const updatedRepo = Object.assign({}, repositoryData, {'firstSuccessfulDeploymentDate': oldIsoDate});
          await database.saveRepositories([updatedRepo]);
        });

        test('should not change it', async() => {
          await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
          await elastic.indices.refresh();
          const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
          expect(repo._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        });
      });
    });

    describe('when ref name does not match with deployment tag name regex', () => {
      beforeEach(async() => {
        const ref1 = Object.assign(_.cloneDeep(refBranchData), {'id': 'ref1'});
        const ref2 = Object.assign(_.cloneDeep(refTagData), {'id': 'ref2'});
        ref1.target.hash = 'a';
        ref2.target.hash = 'a';
        ref2.name = '###not-matching-name###';
        await database.saveRefs([ref1, ref2]);
      });

      test('should not change any commit', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const commitA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
        const commitB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
        const commitC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
        const commitD = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'd'});
        const commitE = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'e'});
        const commitF = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'f'});
        const commitG = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'g'});
        expect(commitA._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitB._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitC._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitD._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitE._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitF._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitG._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });

      test('should not change the repository', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
        expect(repo._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });
    });

    describe('when multiple refs available', () => {
      let date1, date2;

      beforeEach(async() => {
        date1 = new Date(2010,1,1).toISOString();
        date2 = new Date(2012,10,10).toISOString();
        const ref1 = Object.assign(_.cloneDeep(refTagData), {'id': 'ref1'});
        const ref2 = Object.assign(_.cloneDeep(refTagData), refTagData, {'id': 'ref2'});
        ref1.target.hash = 'b';
        ref2.target.hash = 'a';
        ref1.date = date1;
        ref2.date = date2;
        await database.saveRefs([ref1, ref2]);
      });

      test('should start with the older tag', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const commitA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
        const commitB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
        const commitC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
        const commitD = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'd'});
        const commitE = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'e'});
        const commitF = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'f'});
        const commitG = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'g'});
        expect(commitA._source.firstSuccessfulDeploymentDate).toEqual(date2);
        expect(commitB._source.firstSuccessfulDeploymentDate).toEqual(date1);
        expect(commitC._source.firstSuccessfulDeploymentDate).toEqual(date1);
        expect(commitD._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitE._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitF._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitG._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });

      test('should set the first date', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
        expect(repo._source.firstSuccessfulDeploymentDate).toEqual(date1);
      });
    });

    describe('when ref name matches but its not a tag (its a branch)', () => {
      beforeEach(async() => {
        const ref1 = Object.assign(_.cloneDeep(refBranchData), {'id': 'ref1'});
        ref1.target.hash = 'a';
        ref1.name = 'v0.0.1';
        ref1.date = new Date().toISOString(); // a branch ref does not have a date, but just in case
        await database.saveRefs([ref1]);
      });

      test('should not change any commit', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const commitA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
        const commitB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
        const commitC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
        const commitD = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'd'});
        const commitE = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'e'});
        const commitF = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'f'});
        const commitG = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'g'});
        expect(commitA._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitB._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitC._source.firstSuccessfulDeploymentDate).toBeUndefined();
        expect(commitD._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitE._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitF._source.firstSuccessfulDeploymentDate).toEqual(oldIsoDate);
        expect(commitG._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });

      test('should not change the repository', async() => {
        await bitbucketSync.updateFirstSuccessfulDeploymentDate(repositoryData.uuid);
        await elastic.indices.refresh();
        const repo = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': repositoryData.uuid});
        expect(repo._source.firstSuccessfulDeploymentDate).toBeUndefined();
      });
    });
  });
});