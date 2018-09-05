const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');

const BITBUCKET_BASE_API_URL = 'https://api.bitbucket.org/2.0/';
const BITBUCKET_ACCESS_TOKEN_URI = 'https://bitbucket.org/site/oauth2/access_token';
const BITBUCKET_AUTHORIZATION_URI = 'https://bitbucket.org/site/oauth2/authorize';
const DEFAULT_PAGE_LEN = 100;
const DEFAULT_TIMEOUT = 10000;

module.exports = class BitbucketApiClient {
  static async create(options) {
    const axiosOptions = {
      'baseURL': BITBUCKET_BASE_API_URL,
      'headers': {},
      'params': {
        'pagelen': DEFAULT_PAGE_LEN,
      },
      'timeout': DEFAULT_TIMEOUT,
    };
    if (options && options.clientId && options.clientSecret) {
      const token = await BitbucketApiClient.getToken(options);
      axiosOptions.headers.Authorization = `Bearer ${token.accessToken}`;
    }
    return axios.create(axiosOptions);
  }

  static async getToken(options) {
    const authOptions = Object.assign({
      'accessTokenUri': BITBUCKET_ACCESS_TOKEN_URI,
      'authorizationUri': BITBUCKET_AUTHORIZATION_URI,
    }, options);
    const auth = new ClientOAuth2(authOptions);
    return await auth.credentials.getToken();
  }
};