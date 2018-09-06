const MockAdapter = require('axios-mock-adapter');
const BitbucketApiIterator = require('./bitbucket-api-iterator');
const BitbucketApiClient = require('./bitbucket-api-client');

describe('BitbucketApiIterator', () => {
  let mock, iterator, apiClient, url;

  beforeEach(async() => {
    apiClient = await BitbucketApiClient.create();
    url = '/my-url/';
    mock = new MockAdapter(apiClient);
  });

  describe('constructor()', () => {
    test('must fail when no api client received', () => {
      try {
        iterator = new BitbucketApiIterator();
        fail('should fail');
      } catch(e) {
        expect(e.message).toEqual('apiClient and url are required');
      }
    });

    test('must fail when no url received', () => {
      try {
        iterator = new BitbucketApiIterator(apiClient);
        fail('should fail');
      } catch(e) {
        expect(e.message).toEqual('apiClient and url are required');
      }
    });
  });

  describe('next()', () => {
    let anotherUrl, response1, response2;

    beforeEach(() => {
      anotherUrl = 'https://api.bitbucket.org/another-url/';
      response1 = {
        'values': {'a': '1'},
        'next': anotherUrl,
      };
      response2 = {
        'values': {'a': '2'},
      };
      mock.onGet(url).reply(200, response1);
      mock.onGet(anotherUrl).reply(200, response2);
      iterator = new BitbucketApiIterator(apiClient, url);
    });

    describe('when there is next', () => {
      test('when there is next should return a promise with the value and done = false', async() => {
        const result = await iterator.next();
        expect(result.done).toEqual(false);
        expect(result.value).toEqual(response1);
      });
    });

    describe('when there is not next', () => {
      test('when there is next should return a promise with the value and done = true', async() => {
        await iterator.next();
        const result = await iterator.next();
        expect(result.done).toEqual(true);
        expect(result.value).toEqual(response2);
      });
    });
  });
});