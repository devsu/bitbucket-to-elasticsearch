const _ = require('lodash');
const BitbucketApiClient = require('./api-client');
const Database = require('./database');
const logger = require('./logger');
const Queue = require('./queue');
const uuid = require('uuid/v4');
const log = logger.child({'class': 'Sync'});

module.exports = class Sync {
  constructor(config) {
    if (!config || !config.bitbucket || !config.elasticsearch) {
      throw new Error('config.bitbucket and config.elasticsearch are required');
    }
    this.config = config;
    this.bitbucket = new BitbucketApiClient(config.bitbucket);
    this.database = new Database(config.elasticsearch);
    this.deploymentRefsMatcher = new RegExp(config.analytics.deploymentTagsPattern);
  }

  async execute() {
    if (this.config.bitbucket.clientId && this.config.bitbucket.clientSecret) {
      await this.bitbucket.authenticate();
    }
    await this.database.setup();
    await this.synchronizeRepositories();
  }

  async synchronizeRepositories() {
    const repositories = Sync.transformRepositories(await this.getOutdatedRepositories());
    // Refactored without unit tests:
    // do not store repos in bulk (process repos one by one)
    // do not store the repos until all its commits have been processed
    // consider updated_on value for updating only missing commits
    // TODO: Unit tests needed!
    const processRepositoryQueue = Queue.getQueue('processRepo', this.config.bitbucket.queueOptions.processRepo);
    for (let i = 0; i < repositories.length; i++) {
      processRepositoryQueue.add(async() => {
        await this.synchronizeRepository(repositories[i]);
      });
    }
    await processRepositoryQueue.onIdle();
    log.info('All work is done!', repositories.length);
  }

  async synchronizeRepository(repo) {
    const startTime = new Date().getTime();
    log.info({'full_name': repo.full_name}, 'Start: %s', repo.full_name);
    const repoInDatabase = await this.database.getRepository(repo.uuid);
    let minDate = null;
    if (repoInDatabase) {
      minDate = new Date(repoInDatabase.updated_on);
      log.info({'full_name': repo.full_name}, 'Updating only commits newer than %s', minDate);
    }

    await Promise.all([
      this.synchronizeCommits(repo.slug, minDate),
      this.synchronizeRefs(repo.slug),
    ]);
    // Save the repo only after all its commits and refs have been processed.
    // TODO: Unit tests needed
    await this.database.saveRepositories([repo]);
    await Promise.all([
      this.updateFirstSuccessfulBuildDate(repo.uuid),
      this.updateFirstSuccessfulDeploymentDate(repo.uuid),
    ]);
    const endTime = new Date().getTime();
    log.info(
      {'full_name': repo.full_name},
      'Done: %s. It took %d seconds.',
      repo.full_name,
      (endTime - startTime) / 1000
    );
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

  async updateFirstSuccessfulBuildDate(repoUuid) {
    const statuses = await this._getSortedSuccessfulStatuses(repoUuid);
    for (let i = 0; i < statuses.length; i++) {
      const commitsToUpdate = await this.database.getCommitAncestors(statuses[i].commit.hash, (commit) => {
        return !commit.firstSuccessfulBuildDate;
      });
      const repoInDb = await this.database.getRepository(repoUuid);
      const updateInfo = {'firstSuccessfulBuildDate': statuses[i].updated_on};
      await this.database.updateCommits(commitsToUpdate, updateInfo);
      if (!repoInDb.firstSuccessfulBuildDate) {
        await this.database.updateRepositories([repoUuid], updateInfo);
      }
    }
  }

  async updateFirstSuccessfulDeploymentDate(repoUuid) {
    let refs = await this._getSortedMatchingRefs(repoUuid);
    for (let i = 0; i < refs.length; i++) {
      const commitsToUpdate = await this.database.getCommitAncestors(refs[i].target.hash, (commit) => {
        return !commit.firstSuccessfulDeploymentDate;
      });
      const repoInDb = await this.database.getRepository(repoUuid);
      const updateInfo = {'firstSuccessfulDeploymentDate': refs[i].date};
      await this.database.updateCommits(commitsToUpdate, updateInfo);
      await this.database.saveDeployments(
        [{
          'id': uuid(),
          'project': repoInDb.project,
          'deploymentDate': refs[i].date,
          'repository': repoInDb,
          'author': refs[i].target.author
        }]
      );
      if (!repoInDb.firstSuccessfulDeploymentDate) {
        await this.database.updateRepositories([repoUuid], updateInfo);
      }
    }
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

  async synchronizeRefs(repoSlug) {
    const refsIterator = this.bitbucket.getRefsIterator(repoSlug);
    const promises = [];
    for await (const data of refsIterator) {
      const refs = data.values;
      if (!refs.length) {
        continue;
      }
      promises.push(this.database.saveRefs(Sync.transformRefs(refs)));
    }
    await Promise.all(promises);
  }

  async getOutdatedRepositories() {
    const reposIterator = this.bitbucket.getRepositoriesIterator();
    let repositoriesInBitbucket = [];
    log.info('Getting repositories');
    for await (const data of reposIterator) {
      repositoriesInBitbucket.push(...data.values);
    }
    const repositoriesInDb = await this.database.getRepositories();
    const outdatedRepos = repositoriesInBitbucket.filter((repoInBitbucket) => {
      const repoInDb = repositoriesInDb.find((r) => r.uuid === repoInBitbucket.uuid);
      return !repoInDb || (new Date(repoInBitbucket.updated_on).getTime() > new Date(repoInDb.updated_on).getTime());
    });
    log.info('%d repositories found, %d are outdated', repositoriesInBitbucket.length, outdatedRepos.length);
    return outdatedRepos;
  }

  static transformRepository(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    transformed.owner = data.owner.username;
    transformed.project = Sync.transformProject(data.project);
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
      transformed.author.user.email = this.parseEmail(transformed.author.raw);
    }
    delete transformed.repository.links;
    delete transformed.summary;
    transformed.parents = data.parents.map((parent) => parent.hash);
    return transformed;
  }

  static parseEmail(rawName) {
    const startIndex = rawName.indexOf("<") + 1;
    const endIndex = rawName.indexOf(">");
    return rawName.substring(startIndex, endIndex);
  }

  static transformProject(data) {
    const transformed = Object.assign({}, data);
    delete transformed.links;
    return transformed
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

  static transformRef(data) {
    const transformed = Object.assign({}, data);
    transformed.id = `${transformed.target.repository.full_name}#${transformed.name}`;
    delete transformed.links;
    delete transformed.default_merge_strategy;
    delete transformed.merge_strategies;
    transformed.target = Sync.transformCommit(transformed.target);
    if (transformed.tagger && transformed.tagger.user) {
      delete transformed.tagger.user.links;
    }
    return transformed;
  }

  static transformRefs(data) {
    return data.map(Sync.transformRef);
  }

  static obtainSlugs(data) {
    return data.map((item) => item.slug);
  }

  async _getSortedSuccessfulStatuses(repoUuid) {
    let statuses = await this.database.getStatuses(repoUuid);
    statuses = statuses.filter((s) => s.state === 'SUCCESSFUL');
    return _.orderBy(statuses, ['updated_on'], ['asc']);
  }

  async _getSortedMatchingRefs(repoUuid) {
    let refs = await this.database.getRefs(repoUuid);
    refs = refs.filter((r) => r.date && r.type === 'tag' && this.deploymentRefsMatcher.test(r.name));
    return _.orderBy(refs, ['date'], ['asc']);
  }
};