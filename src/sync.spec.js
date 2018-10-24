const BitbucketSync = require('./sync');
const bitbucketRepositoryData = require('../integration-tests/repository-bitbucket');
const esRepositoryData = require('../integration-tests/repository-es');
const bitbucketCommitData = require('../integration-tests/commit-bitbucket');
const esCommitData = require('../integration-tests/commit-es');
const bitbucketStatusData = require('../integration-tests/status-bitbucket');
const esStatusData = require('../integration-tests/status-es');
const bitbucketRefData = require('../integration-tests/ref-bitbucket');
const esRefData = require('../integration-tests/ref-es');

describe('BitbucketSync', () => {
  let bitbucketSync, config;

  beforeEach(() => {
    config = {
      'bitbucket': {
        'username': 'devsu',
      },
      'elasticsearch': {
      },
    };
    bitbucketSync = new BitbucketSync(config);
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
      delete config.bitbucket;
      try {
        bitbucketSync = new BitbucketSync(config);
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });

    test('should fail when no config.elasticsearch', () => {
      delete config.elasticsearch;
      try {
        bitbucketSync = new BitbucketSync(config);
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
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRef(bitbucketRefData);
      expect(actual).toEqual(esRefData);
    });
  });

  describe('transformRefs()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformRefs([bitbucketRefData, bitbucketRefData]);
      expect(actual).toEqual([esRefData, esRefData]);
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