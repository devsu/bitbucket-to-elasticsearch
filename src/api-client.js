const URL = require('url').URL;
const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');
const ApiIterator = require('./api-iterator');
const Queue = require('./queue');

const BITBUCKET_BASE_API_URL = 'https://api.bitbucket.org/2.0';
const BITBUCKET_ACCESS_TOKEN_URI = 'https://bitbucket.org/site/oauth2/access_token';
const BITBUCKET_AUTHORIZATION_URI = 'https://bitbucket.org/site/oauth2/authorize';
const DEFAULT_PAGE_LEN = 100; // max supported by bitbucket

module.exports = class ApiClient {
  constructor(config) {
    if (!config || !config.username) {
      throw new Error('config.username is required');
    }
    this.config = config;
    const axiosOptions = {
      'headers': {},
      'params': {
        'pagelen': DEFAULT_PAGE_LEN,
      },
      'timeout': config.defaultTimeout,
    };
    if (!config.queueOptions) {
      config.queueOptions = {};
    }
    this.axiosInstance = axios.create(axiosOptions);
    this.repositoriesQueue = Queue.getQueue('repositories');
    this.commitsQueue = Queue.getQueue('commits', config.queueOptions.commits);
    this.statusesQueue = Queue.getQueue('statuses', config.queueOptions.statuses);
    this.refsQueue = Queue.getQueue('refs', config.queueOptions.refs);
  }

  async authenticate() {
    if (!this.config || !this.config.clientId || !this.config.clientSecret) {
      throw new Error('clientId and clientSecret are required for authentication');
    }
    const token = await this.getToken();
    this.axiosInstance.defaults.headers.Authorization = `Bearer ${token.accessToken}`;
  }

  async getToken() {
    const authOptions = {
      'accessTokenUri': BITBUCKET_ACCESS_TOKEN_URI,
      'authorizationUri': BITBUCKET_AUTHORIZATION_URI,
      'clientId': this.config.clientId,
      'clientSecret': this.config.clientSecret,
    };
    const auth = new ClientOAuth2(authOptions);
    return await auth.credentials.getToken();
  }

  getRepositoriesIterator() {
    const url = new URL(`${BITBUCKET_BASE_API_URL}/repositories/${this.config.username}`);
    url.searchParams.set('sort', '-updated_on');
    return new ApiIterator(this.repositoriesQueue, this.axiosInstance, url.toString());
  }

  getCommitsIterator(repoSlug, minDate) {
    let options = null;
    if (!repoSlug) {
      throw new Error('repoSlug is required');
    }
    if (minDate) {
      options = {
        'interceptorFn': (it) => {
          if (!it.currentState || !it.currentState.value || !it.currentState.value.values) {
            return;
          }
          const commits = it.currentState.value.values;
          if (new Date(commits[commits.length - 1].date).getTime() < minDate.getTime()) {
            it.nextUrl = null;
          }
        }
      }
    }
    const url = `${BITBUCKET_BASE_API_URL}/repositories/${this.config.username}/${repoSlug}/commits`;
    return new ApiIterator(this.commitsQueue, this.axiosInstance, url, options);
  }

  getStatusesIterator(repoSlug, node) {
    if (!repoSlug || !node) {
      throw new Error('repoSlug and node are required');
    }
    const url = `${BITBUCKET_BASE_API_URL}/repositories/${this.config.username}/${repoSlug}/commit/${node}/statuses`;
    return new ApiIterator(this.statusesQueue, this.axiosInstance, url.toString());
  }

  getRefsIterator(repoSlug) {
    if (!repoSlug) {
      throw new Error('repoSlug is required');
    }
    const url = `${BITBUCKET_BASE_API_URL}/repositories/${this.config.username}/${repoSlug}/refs`;
    return new ApiIterator(this.refsQueue, this.axiosInstance, url.toString());
  }
};