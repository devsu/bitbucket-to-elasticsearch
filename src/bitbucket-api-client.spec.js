const ClientOAuth2 = require('client-oauth2');
const BitbucketApiClient = require('./bitbucket-api-client');
const clientOAuth2 = new ClientOAuth2();

describe('BitbucketApiClient', () => {
  beforeEach(() => {
    clientOAuth2.credentials.getToken.mockClear();
  });

  describe('create()', () => {
    describe('when options sent', () => {
      test('should get a token with the given auth options', async() => {
        const options = {
          'clientId': 'my-client',
          'clientSecret': 'my-secret',
        };
        const api = await BitbucketApiClient.create(options);
        expect(clientOAuth2.credentials.getToken).toHaveBeenCalledTimes(1);
        expect(api.defaults.headers.Authorization).toEqual('Bearer my-token');
      });
    });

    describe('when no options sent', () => {
      test('should not set authorization header', async() => {
        const api = await BitbucketApiClient.create();
        expect(clientOAuth2.credentials.getToken).not.toBeCalled();
        expect(api.defaults.headers.Authorization).toBeUndefined();
      });
    });

    describe('when no options.clientId and options.clientSecret sent', () => {
      test('should not set authorization header', async() => {
        const api = await BitbucketApiClient.create({});
        expect(clientOAuth2.credentials.getToken).not.toBeCalled();
        expect(api.defaults.headers.Authorization).toBeUndefined();
      });
    });

    test('should return an axios instance configured to connect to the bitbucket API', async() => {
      const api = await BitbucketApiClient.create();
      expect(api.defaults.baseURL).toBeDefined();
      expect(api.defaults.params).toBeDefined();
      expect(api.defaults.timeout).toBeDefined();
    });
  });
});