jest.unmock('client-oauth2');
const BitbucketSync = require('../src/bitbucket-sync');

describe('BitbucketSync integration tests', () => {
  let bitbucketSync, options;

  beforeEach(() => {
    options = {
      'username': 'devsu',
    };
    bitbucketSync = new BitbucketSync(options);
  });

  describe('execute()', () => {
    test('should import all repos', async() => {
      await bitbucketSync.execute();
    });
  });
});