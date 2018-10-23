const ClientOAuth2 = require('client-oauth2');
const BitbucketApiClient = require('./api-client');
const BitbucketApiIterator = require('./api-iterator');
const clientOAuth2 = new ClientOAuth2();

describe('BitbucketApiClient', () => {
  let config, api;

  beforeEach(() => {
    clientOAuth2.credentials.getToken.mockClear();
    config = {
      'clientId': 'my-client',
      'clientSecret': 'my-secret',
      'username': 'devsu',
    };
    api = new BitbucketApiClient(config);
  });

  describe('constructor()', () => {
    test('should fail when no config.username set', () => {
      delete config.username;
      try {
        api = new BitbucketApiClient(config);
        fail('should fail');
      } catch (e) {
        expect(e.message).toEqual('config.username is required');
      }
    });
  });

  describe('authenticate()', () => {
    describe('when config is set', () => {
      test('should getQueue a token and set it in the axios instance', async() => {
        await api.authenticate();
        expect(clientOAuth2.credentials.getToken).toHaveBeenCalledTimes(1);
        const constructorArgs = ClientOAuth2.mockGetConstructorArgs().pop();
        expect(constructorArgs).toEqual([{
          'accessTokenUri': expect.any(String),
          'authorizationUri': expect.any(String),
          'clientId': 'my-client',
          'clientSecret': 'my-secret',
        }]);
        expect(api.axiosInstance.defaults.headers.Authorization).toEqual('Bearer my-token');
      });
    });

    describe('when no config.clientId and config.clientSecret are set', () => {
      test('should throw an error', async() => {
        delete config.clientId;
        const api = new BitbucketApiClient(config);
        try {
          await api.authenticate();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('clientId and clientSecret are required for authentication');
        }
      });
    });
  });

  describe('getRepositoriesIterator()', () => {
    test('should return an iterator pointing to the corresponding url', () => {
      const iterator = api.getRepositoriesIterator();
      expect(iterator).toBeInstanceOf(BitbucketApiIterator);
      expect(iterator.nextUrl).toEqual(`https://api.bitbucket.org/2.0/repositories/${config.username}`);
    });
  });

  describe('getCommitsIterator()', () => {
    let repoSlug, iterator;

    beforeEach(() => {
      repoSlug = 'my-repo-slug';
    });

    describe('when missing required arguments', () => {
      test('should throw error', () => {
        try {
          iterator = api.getCommitsIterator();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('repoSlug is required');
        }
      });
    });

    test('should return an iterator pointing to the corresponding url', () => {
      const iterator = api.getCommitsIterator(repoSlug);
      expect(iterator).toBeInstanceOf(BitbucketApiIterator);
      expect(iterator.nextUrl).toEqual(
        `https://api.bitbucket.org/2.0/repositories/${config.username}/${repoSlug}/commits`);
    });

    describe.skip('when minDate recieved', () => {
      test('should return an iterator that stops when reaching that date', () => {
        // TODO: implement
      });
    });
  });

  describe('getStatusesIterator()', () => {
    let repoSlug, node, iterator;

    beforeEach(() => {
      repoSlug = 'my-repo-slug';
      node = '1234567890';
    });

    describe('when missing required arguments', () => {
      test('should throw error', () => {
        try {
          iterator = api.getStatusesIterator();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('repoSlug and node are required');
        }
      });
    });

    test('should return an iterator pointing to the corresponding url', () => {
      const iterator = api.getStatusesIterator(repoSlug, node);
      expect(iterator).toBeInstanceOf(BitbucketApiIterator);
      expect(iterator.nextUrl).toEqual(
        `https://api.bitbucket.org/2.0/repositories/${config.username}/${repoSlug}/commit/${node}/statuses`);
    });
  });
});