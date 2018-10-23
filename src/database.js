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
      'body': Database.getBulkUpsertBody('repositories', 'repository', 'uuid', data),
    });
  }

  async saveCommits(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database.getBulkUpsertBody('commits', 'commit', 'hash', data),
    });
  }

  async saveStatuses(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database.getBulkUpsertBody('statuses', 'status', 'id', data),
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

  static getBulkUpsertBody(index, type, id, data) {
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
}

module.exports = Database;