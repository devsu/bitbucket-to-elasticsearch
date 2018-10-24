const elasticsearch = require('elasticsearch');

class Database {
  constructor(config) {
    // Cloning the config object due to this issue https://github.com/elastic/elasticsearch-js/issues/33
    this.elastic = new elasticsearch.Client(Object.assign({}, config));
  }

  async setup() {
    const repositoriesIndexExists = await this.elastic.indices.exists({'index': 'repositories'});
    const commitsIndexExists = await this.elastic.indices.exists({'index': 'commits'});
    const statusesIndexExists = await this.elastic.indices.exists({'index': 'statuses'});
    if (!repositoriesIndexExists) {
      await this.elastic.indices.create({'index': 'repositories'});
    }
    if (!commitsIndexExists) {
      await this.elastic.indices.create({'index': 'commits'});
    }
    if (!statusesIndexExists) {
      await this.elastic.indices.create({'index': 'statuses'});
    }
  }

  async saveRepositories(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database._getBulkUpsertBody('repositories', 'repository', 'uuid', data),
      'refresh': true,
    });
  }

  async saveCommits(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database._getBulkUpsertBody('commits', 'commit', 'hash', data),
      'refresh': true,
    });
  }

  async saveStatuses(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database._getBulkUpsertBody('statuses', 'status', 'id', data),
      'refresh': true,
    });
  }

  async getRepository(uuid) {
    try {
      const repositoryResponse = await this.elastic.get({
        'index': 'repositories',
        'type': 'repository',
        'id': uuid,
      });
      return repositoryResponse._source;
    } catch (e) {
      return null;
    }
  }

  async getCommit(hash) {
    try {
      const response = await this.elastic.get({
        'index': 'commits',
        'type': 'commit',
        'id': hash,
      });
      return response._source;
    } catch (e) {
      return null;
    }
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

  async updateCommits(hashes, properties) {
    const body = Database._getBulkUpdateBody('commits', 'commit', hashes, properties);
    if (body.length) {
      return await this.elastic.bulk({
        'body': body,
        'refresh': true,
      });
    }
  }

  async getBuildStatuses(repoUuid) {
    const response = await this.elastic.search({
      'index': 'statuses',
      'type': 'status',
      'q': `repository.uuid:"${repoUuid}"`,
      'size': -1,
    });
    return response.hits.hits.map((s) => s._source);
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