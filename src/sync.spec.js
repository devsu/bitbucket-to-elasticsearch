const BitbucketSync = require('./sync');
const bitbucketRepositoryData = require('../integration-tests/repository-bitbucket');
const esRepositoryData = require('../integration-tests/repository-es');
const bitbucketCommitData = require('../integration-tests/commit-bitbucket');
const esCommitData = require('../integration-tests/commit-es');

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
  });

  describe('transformCommits()', () => {
    test('should transform bitbucket data to elastic search data', () => {
      const actual = BitbucketSync.transformCommits([bitbucketCommitData, bitbucketCommitData]);
      expect(actual).toEqual([esCommitData, esCommitData]);
    });
  });
});