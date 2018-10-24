const BitbucketSync = require('./sync');
const config = require('./config');
const bitbucketRepositoryData = require('../integration-tests/repository-bitbucket');
const esRepositoryData = require('../integration-tests/repository-es');
const bitbucketCommitData = require('../integration-tests/commit-bitbucket');
const esCommitData = require('../integration-tests/commit-es');
const bitbucketStatusData = require('../integration-tests/status-bitbucket');
const esStatusData = require('../integration-tests/status-es');
const bitbucketRefBranchData = require('../integration-tests/ref-branch-bitbucket');
const esRefBranchData = require('../integration-tests/ref-branch-es');
const bitbucketRefTagData = require('../integration-tests/ref-tag-bitbucket');
const esRefTagData = require('../integration-tests/ref-tag-es');

describe('BitbucketSync', () => {
  let bitbucketSync, customConfig;

  beforeEach(() => {
    customConfig = Object.assign({}, config);
    customConfig.bitbucket.username = 'devsu';
    bitbucketSync = new BitbucketSync(customConfig);
  });

  describe('constructor', () => {
    test('should fail when no config', () => {
      try {
        bitbucketSync = new BitbucketSync();
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });

    test('should fail when no config.bitbucket', () => {
      delete customConfig.bitbucket;
      try {
        bitbucketSync = new BitbucketSync(customConfig);
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });

    test('should fail when no config.elasticsearch', () => {
      delete customConfig.elasticsearch;
      try {
        bitbucketSync = new BitbucketSync(customConfig);
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });
  });

  describe('transformRepository()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRepository(bitbucketRepositoryData);
      expect(actual).toEqual(esRepositoryData);
    });
  });

  describe('transformRepositories()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRepositories([bitbucketRepositoryData, bitbucketRepositoryData]);
      expect(actual).toEqual([esRepositoryData, esRepositoryData]);
    });
  });

  describe('transformCommit()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformCommit(bitbucketCommitData);
      expect(actual).toEqual(esCommitData);
    });

    test('should not fail when no author.user', () => {
      const bitbucketCommitDataCopy = Object.assign({}, bitbucketCommitData);
      delete bitbucketCommitDataCopy.author.user;
      const esCommitDataCopy = Object.assign({}, esCommitData);
      delete esCommitDataCopy.author.user;
      const actual = BitbucketSync.transformCommit(bitbucketCommitDataCopy);
      expect(actual).toEqual(esCommitDataCopy);
    });
  });

  describe('transformCommits()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformCommits([bitbucketCommitData, bitbucketCommitData]);
      expect(actual).toEqual([esCommitData, esCommitData]);
    });
  });

  describe('transformStatus()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformStatus(bitbucketStatusData);
      expect(actual).toEqual(esStatusData);
    });
  });

  describe('transformStatuses()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformStatuses([bitbucketStatusData, bitbucketStatusData]);
      expect(actual).toEqual([esStatusData, esStatusData]);
    });
  });

  describe('transformRef()', () => {
    test('should transform branch bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRef(bitbucketRefBranchData);
      expect(actual).toEqual(esRefBranchData);
    });

    test('should transform tag bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRef(bitbucketRefTagData);
      expect(actual).toEqual(esRefTagData);
    });
  });

  describe('transformRefs()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRefs([bitbucketRefBranchData, bitbucketRefTagData]);
      expect(actual).toEqual([esRefBranchData, esRefTagData]);
    });
  });

  describe('obtainSlugs()', () => {
    test('should return an array with the repo slugs', () => {
      const actual = BitbucketSync.obtainSlugs([bitbucketRepositoryData, bitbucketRepositoryData]);
      expect(actual).toEqual([bitbucketRepositoryData.slug, bitbucketRepositoryData.slug]);
    });
  });

  // TODO: Missing tests (functionality actually implemented, but no tests implemented)
  // - should not fail when repo has no commits
  // - should not fail when commit has no build statuses
});