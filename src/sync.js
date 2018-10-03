const BitbucketApiClient = require('./api-client');
const Database = require('./database');

module.exports = class Sync {
  constructor(config) {
    if (!config || !config.bitbucket || !config.elasticsearch) {
      throw new Error('config.bitbucket and config.elasticsearch are required');
    }
    this.config = config;
    this.bitbucket = new BitbucketApiClient(config.bitbucket);
    this.database = new Database(config.elasticsearch);
  }

  async execute() {
    if (this.config.bitbucket.clientId && this.config.bitbucket.clientSecret) {
      await this.bitbucket.authenticate();
    }
    await this.database.setup();
    await this.synchronizeRepositories();
  }

  async synchronizeRepositories() {
    let startDate = await this.database.getRepositoriesMaxDate();
    const reposIterator = this.bitbucket.getRepositoriesIterator(startDate);
    const promises = [];
    for await (const data of reposIterator) {
      const repositories = data.values;
      const slugs = Sync.obtainSlugs(repositories);
      promises.push(this.database.saveRepositories(Sync.transformRepositories(repositories)));
      promises.push(...slugs.map((slug) => this.synchronizeCommits(slug, startDate)));
    }
    await Promise.all(promises);
  }

  async synchronizeCommits(repoSlug, startDate) {
    const commitsIterator = this.bitbucket.getCommitsIterator(repoSlug, startDate);
    const promises = [];
    for await (const data of commitsIterator) {
      const commits = data.values;
      if (!commits.length) {
        continue;
      }
      const nodes = commits.map((commit) => commit.hash);
      promises.push(this.database.saveCommits(Sync.transformCommits(commits)));
      promises.push(...nodes.map((node) => this.synchronizeStatuses(repoSlug, node)));
    }
    await Promise.all(promises);
  }

  async synchronizeStatuses(repoSlug, node) {
    const statusesIterator = this.bitbucket.getStatusesIterator(repoSlug, node);
    const promises = [];
    for await (const data of statusesIterator) {
      const statuses = data.values;
      if (!statuses.length) {
        continue;
      }
      promises.push(this.database.saveStatuses(Sync.transformStatuses(statuses)));
    }
    await Promise.all(promises);
  }

  static transformRepository(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    transformed.owner = data.owner.username;
    transformed.project = data.project.key;
    transformed.mainbranch = data.mainbranch ? data.mainbranch.name : data.mainbranch;
    return transformed;
  }

  static transformRepositories(data) {
    return data.map(Sync.transformRepository);
  }

  static transformCommit(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    delete transformed.author.user.account_id;
    delete transformed.author.user.links;
    delete transformed.repository.links;
    delete transformed.repository.type;
    delete transformed.summary;
    transformed.parents = data.parents.map((parent) => parent.hash);
    return transformed;
  }

  static transformCommits(data) {
    return data.map(Sync.transformCommit);
  }

  static transformStatus(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    delete transformed.repository.links;
    delete transformed.commit.links;
    transformed.id = `${data.commit.hash}-${data.key}`;
    return transformed;
  }

  static transformStatuses(data) {
    return data.map(Sync.transformStatus);
  }

  static obtainSlugs(data) {
    return data.map((item) => item.slug);
  }
};