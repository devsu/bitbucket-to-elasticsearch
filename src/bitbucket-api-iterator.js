module.exports = class BitbucketApiIterator {
  constructor(apiClient, url) {
    if (!apiClient || !url) {
      throw new Error('apiClient and url are required');
    }
    this.apiClient = apiClient;
    this.nextUrl = url;
  }

  async next() {
    const response = await this.apiClient.get(this.nextUrl);
    const value = response.data;
    let done = true;
    if (response.data.next) {
      this.nextUrl = response.data.next;
      done = false;
    }
    return { done, value };
  }
};