const BitbucketApiClient = require('./api-client');
const Database = require('./database');
const logger = require('./logger');
const Queue = require('./queue');
const log = logger.child({'class': 'Sync'});

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
    let repositories = [];
    log.info('Getting repositories');
    for await (const data of reposIterator) {
      repositories.push(...data.values);
    }
    log.info('Done getting repositories. %d repositories found.', repositories.length);
    // Refactored without unit tests:
    // do not store repos in bulk (process repos one by one)
    // do not store the repos until all its commits have been processed
    // consider updated_on value for updating only missing commits
    // TODO: Unit tests needed!
    repositories = Sync.transformRepositories(repositories);
    const processRepositoryQueue = Queue.getQueue('processRepo', {'concurrency': 10});
    for (let i = 0; i < repositories.length; i++) {
      processRepositoryQueue.add(async() => {
        await this.synchronizeRepository(repositories[i]);
      });
    }
    await processRepositoryQueue.onIdle();
    log.info('All work is done!', repositories.length);
  }

  async synchronizeRepository(repo) {
    log.info({'full_name': repo.full_name}, 'Start sync: %s', repo.full_name);
    const repoInDatabase = await this.database.getRepository(repo.uuid);
    let minDate = null;
    if (repoInDatabase) {
      minDate = new Date(repoInDatabase.updated_on);
      log.info({'full_name': repo.full_name}, 'Updating only commits newer than %s', minDate);
    }
    // Save the repo only after all its commits have been processed.
    // TODO: Unit tests needed
    await this.synchronizeCommits(repo.slug, minDate);
    await this.database.saveRepositories([repo]);
    log.info({'full_name': repo.full_name}, 'Sync done: %s', repo.full_name);
  }

  async synchronizeCommits(repoSlug, minDate) {
    const commitsIterator = this.bitbucket.getCommitsIterator(repoSlug, minDate);
    const promises = [];
    for await (const data of commitsIterator) {
      const commits = data.values.filter((commit) => {
        // TODO: this filter does not have tests
        return !minDate || (new Date(commit.date)).getTime() > minDate.getTime();
      });
      if (!commits.length) {
        continue;
      }
      const nodes = commits.map((commit) => commit.hash);
      promises.push(...nodes.map((node) => this.synchronizeStatuses(repoSlug, node)));
      promises.push(this.database.saveCommits(Sync.transformCommits(commits)));
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
    if (transformed.author.user) {
      delete transformed.author.user.links;
    }
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