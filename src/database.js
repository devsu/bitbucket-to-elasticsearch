const elasticsearch = require('elasticsearch');
const logger = require('./logger');
const log = logger.child({'class': 'Database'});

class Database {
  constructor(config) {
    // Cloning the config object due to this issue https://github.com/elastic/elasticsearch-js/issues/33
    this.elastic = new elasticsearch.Client(Object.assign({}, config));
  }

  async setup() {
    const repositoriesIndexExists = await this.elastic.indices.exists({'index': 'repositories'});
    const commitsIndexExists = await this.elastic.indices.exists({'index': 'commits'});
    const statusesIndexExists = await this.elastic.indices.exists({'index': 'statuses'});
    const refsIndexExists = await this.elastic.indices.exists({'index': 'refs'});
    const deploymentsIndexExists = await this.elastic.indices.exists({'index': 'deployments'});

    if (!repositoriesIndexExists) {
      await this.elastic.indices.create({'index': 'repositories'});
    }
    if (!commitsIndexExists) {
      await this.elastic.indices.create({'index': 'commits'});
    }
    if (!statusesIndexExists) {
      await this.elastic.indices.create({'index': 'statuses'});
    }
    if (!refsIndexExists) {
      await this.elastic.indices.create({'index': 'refs'});
    }
    if (!deploymentsIndexExists) {
      await this.elastic.indices.create({'index': 'deployments'});
    }

  }

  async saveRepositories(data) {
    return await this._saveAll('repositories', 'repository', 'uuid', data);
  }

  async saveCommits(data) {
    return await this._saveAll('commits', 'commit', 'hash', data);
  }

  async saveStatuses(data) {
    return await this._saveAll('statuses', 'status', 'id', data);
  }

  async saveRefs(data) {
    return await this._saveAll('refs', 'ref', 'id', data);
  }

  async saveDeployments(data) {
    return await this._saveAll('deployments', 'deployment', 'id', data);
  }

  async getRepository(uuid) {
    return await this._getOne('repositories', 'repository', uuid);
  }

  async getCommit(hash) {
    return await this._getOne('commits', 'commit', hash);
  }

  async getCommitAncestors(hash, filter, accum) {
    const ancestors = accum || [];
    const commit = await this.getCommit(hash);
    if (commit && !ancestors.includes(hash) && (!filter || filter(commit))) {
      ancestors.push(commit.hash);
      await Promise.all(commit.parents.map((parent) => {
        return this.getCommitAncestors(parent, filter, ancestors);
      }));
    }
    return ancestors;
  }

  async updateCommits(hashes, data) {
    return await this._updateAll('commits', 'commit', hashes, data);
  }

  async updateRepositories(uuids, data) {
    return await this._updateAll('repositories', 'repository', uuids, data);
  }

  async getRepositories() {
    return await this._getAll('repositories', 'repository');
  }

  async getStatuses(repoUuid) {
    const query = `repository.uuid:"${repoUuid}"`;
    return await this._getAll('statuses', 'status', query);
  }

  async getRefs(repoUuid) {
    const query = `target.repository.uuid:"${repoUuid}"`;
    return await this._getAll('refs', 'ref', query);
  }

  async reset(){
    await this.elastic.indices.delete({'index': 'repositories'});
    await this.elastic.indices.delete({'index': 'commits'});
    await this.elastic.indices.delete({'index': 'statuses'});
    await this.elastic.indices.delete({'index': 'refs'});
    await this.elastic.indices.delete({'index': 'deployments'});
  }

  async _getOne(index, type, id) {
    try {
      const response = await this.elastic.get({index, type, id});
      return response._source;
    } catch (e) {
      if (e.status === 404) {
        // not found, return null
        return null;
      }
      // another error, log and rethrow
      log.error(e);
      throw e;
    }
  }

  async _getAll(index, type, query) {
    // TODO: Elasticsearch search limit is 10000, we should make queries scrollables!
    const options = {
      'index': index,
      'type': type,
      'size': 10000,
    };
    if (query) {
      options.q = query;
    }
    const response = await this.elastic.search(options);
    if (response.hits.total >= 9999) {
      log.warn('data probably missing! Scroll needs to be implemented!');
    }
    return response.hits.hits.map((s) => s._source);
  }

  async _saveAll(index, type, idProperty, data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database._getBulkUpsertBody(index, type, idProperty, data),
      'refresh': true,
    });
  }

  async _updateAll(index, type, ids, data) {
    const body = Database._getBulkUpdateBody(index, type, ids, data);
    if (body.length) {
      return await this.elastic.bulk({
        'body': body,
        'refresh': true,
      });
    }
  }

  static _getBulkUpsertBody(index, type, id, data) {
    return data.reduce((acum, value) => {
      const updateAction = {
        'update': { '_index': index, '_type': type, '_id': value[id] },
      };
      const document = {
        'doc': value,
        'doc_as_upsert': true,
      };
      acum.push(updateAction);
      acum.push(document);
      return acum;
    }, []);
  }

  static _getBulkUpdateBody(index, type, ids, properties) {
    return ids.reduce((acum, id) => {
      const updateAction = {
        'update': { '_index': index, '_type': type, '_id': id },
      };
      const document = {
        'doc': properties,
      };
      acum.push(updateAction);
      acum.push(document);
      return acum;
    }, []);
  }
}

module.exports = Database;