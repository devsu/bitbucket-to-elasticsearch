const PQueue = require('p-queue');
const MockAdapter = require('axios-mock-adapter');
const BitbucketApiIterator = require('./api-iterator');
const BitbucketApiClient = require('./api-client');

describe('ApiIterator', () => {
  let mock, iterator, bitbucketApiClient, queue, httpClient, url;

  beforeEach(async() => {
    bitbucketApiClient = new BitbucketApiClient({'username': 'devsu'});
    httpClient = bitbucketApiClient.axiosInstance;
    url = '/my-url/';
    mock = new MockAdapter(httpClient);
    queue = new PQueue();
  });

  describe('constructor()', () => {
    test('must fail when no queue received', () => {
      try {
        iterator = new BitbucketApiIterator();
        fail('should fail');
      } catch(e) {
        expect(e.message).toEqual('queue, httpClient and url are required');
      }
    });

    test('must fail when no api client received', () => {
      try {
        iterator = new BitbucketApiIterator(queue);
        fail('should fail');
      } catch(e) {
        expect(e.message).toEqual('queue, httpClient and url are required');
      }
    });

    test('must fail when no url received', () => {
      try {
        iterator = new BitbucketApiIterator(queue, httpClient);
        fail('should fail');
      } catch(e) {
        expect(e.message).toEqual('queue, httpClient and url are required');
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
      iterator = new BitbucketApiIterator(queue, httpClient, url);
    });

    describe('when there is nextUrl (1st pass)', () => {
      test('when there is next should return a promise with the value and done = false', async() => {
        const result = await iterator.next();
        expect(result.done).toEqual(false);
        expect(result.value).toEqual(response1);
      });
    });

    describe('when there is nextUrl (2nd pass)', () => {
      test('when there is next should return a promise with the value and done = false', async() => {
        await iterator.next();
        const result = await iterator.next();
        expect(result.done).toEqual(false);
        expect(result.value).toEqual(response2);
      });
    });

    describe('when there is not nextUrl (3rd pass)', () => {
      test('when there is next should return a promise without value and done = true', async() => {
        await iterator.next();
        await iterator.next();
        const result = await iterator.next();
        expect(result.done).toEqual(true);
        expect(result.value).toBeUndefined();
      });
    });

    test('should use queue, to control concurrency', async() => {
      jest.spyOn(queue, 'add');
      await iterator.next();
      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    test('should set the currentState', async() => {
      const result = await iterator.next();
      expect(iterator.currentState).toEqual(result);
    });

    describe('option: interceptorFn', () => {
      let options;

      beforeEach(() => {
        options = {
          'interceptorFn': jest.fn((it) => {
            it.nextUrl = null;
          }),
        };
        iterator = new BitbucketApiIterator(queue, httpClient, url, options);
      });

      test('should tun the interceptorFn', async() => {
        const result = await iterator.next();
        expect(result.done).toEqual(true);
        expect(result.value).toBeUndefined();
        expect(options.interceptorFn).toHaveBeenCalledTimes(1);
      });
    });
  });

  test('must be iterable', () => {
    const iterator = new BitbucketApiIterator(queue, httpClient, url);
    expect(iterator[Symbol.asyncIterator]).toBeDefined();
    expect(iterator[Symbol.asyncIterator]()).toEqual(iterator);
  });
});