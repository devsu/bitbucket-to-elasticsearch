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
    const reposIterator = this.bitbucket.getRepositoriesIterator();
    const promises = [];
    for await (const data of reposIterator) {
      const repositories = data.values;
      const slugs = Sync.obtainSlugs(repositories);
      promises.push(this.database.saveRepositories(Sync.transformRepositories(repositories)));
      promises.push(...slugs.map((slug) => this.synchronizeCommits(slug)));
    }
    await Promise.all(promises);
  }

  async synchronizeCommits(repoSlug) {

    const commitsIterator = this.bitbucket.getCommitsIterator(repoSlug);
    const promises = [];
    for await (const data of commitsIterator) {
      const commits = data.values;
      promises.push(this.database.saveCommits(Sync.transformCommits(commits)));
    }
    await Promise.all(promises);
  }

  static transformRepository(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    transformed.owner = data.owner.username;
    transformed.project = data.project.key;
    transformed.mainbranch = data.mainbranch.name;
    transformed.uuid = data.uuid.replace(/[{}]/g, '');
    transformed.id = transformed.uuid;
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
    transformed.id = data.hash;
    transformed.author.user.uuid = data.author.user.uuid.replace(/[{}]/g, '');
    transformed.repository.uuid = data.repository.uuid.replace(/[{}]/g, '');
    transformed.parents = data.parents.map((parent) => parent.hash);
    return transformed;
  }

  static transformCommits(data) {
    return data.map(Sync.transformCommit);
  }

  static obtainSlugs(data) {
    return data.map((item) => item.slug);
  }
};