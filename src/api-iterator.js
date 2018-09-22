const logger = require('./logger');
const log = logger.child({'class': 'ApiIterator'});

module.exports = class ApiIterator {
  constructor(queue, httpClient, url, options) {
    if (!queue || !httpClient || !url) {
      throw new Error('queue, httpClient and url are required');
    }
    this.queue = queue;
    this.httpClient = httpClient;
    this.nextUrl = url;
    this.options = options;
  }

  async next() {
    if (this.options && this.options.interceptorFn) {
      this.options.interceptorFn(this);
    }
    if (!this.nextUrl) {
      return {'done': true};
    }
    return new Promise((resolve) => {
      this.queue.add(async() => {
        const response = await this.httpClient.get(this.nextUrl);
        const done = false;
        const value = response.data;
        this.nextUrl = null;
        if (response && response.data) {
          this.nextUrl = response.data.next;
        }
        log.debug({'queue': this.queue.name}, 'Resolved');
        log.debug({'queue': this.queue.name}, 'Size: %d', this.queue.size);
        log.debug({'queue': this.queue.name}, 'Pending: %d', this.queue.pending - 1);
        this.currentState = { done, value };
        return resolve(this.currentState);
      });
      log.info({'queue': this.queue.name}, 'Queued %s', this.nextUrl);
      log.debug({'queue': this.queue.name}, 'Size: %d', this.queue.size);
      log.debug({'queue': this.queue.name}, 'Pending: %d', this.queue.pending);
    });
  }

  [Symbol.asyncIterator]() {
    return this;
  }
};