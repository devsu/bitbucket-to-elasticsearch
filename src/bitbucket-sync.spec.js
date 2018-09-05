const BitbucketSync = require('./bitbucket-sync');

describe('BitbucketSync', () => {
  let bitbucketSync, options;

  beforeEach(() => {
    options = {
      'username': 'devsu',
    };
  });

  describe('constructor', () => {
    test('should fail when no options', () => {
      try {
        bitbucketSync = new BitbucketSync();
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });

    test('should fail when no options.username', () => {
      delete options.username;
      try {
        bitbucketSync = new BitbucketSync(options);
        fail('should fail');
      } catch (error) {
        expect(error.message).toMatch(/.+ required/);
      }
    });
  });
});