const elasticsearch = require('elasticsearch');

class Database {
  constructor(config) {
    // Cloning the config object due to this issue https://github.com/elastic/elasticsearch-js/issues/33
    this.elastic = new elasticsearch.Client(Object.assign({}, config));
  }

  async setup() {
    const repositoriesIndexExists = await this.elastic.indices.exists({'index': 'repositories'});
    const commitsIndexExists = await this.elastic.indices.exists({'index': 'commits'});
    if (!repositoriesIndexExists) {
      await this.elastic.indices.create({'index': 'repositories'});
    }
    if (!commitsIndexExists) {
      await this.elastic.indices.create({'index': 'commits'});
    }
  }

  async saveRepositories(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database.getBulkUpsertBody('repositories', 'repository', data),
    });
  }

  async saveCommits(data) {
    if (!data) {
      throw new Error('data is required');
    }
    return await this.elastic.bulk({
      'body': Database.getBulkUpsertBody('commits', 'commit', data),
    });
  }

  async getRepositoriesMaxDate() {
    const response = await this.elastic.search({
      'index': 'repositories',
      'body': {'aggs': {'maxDate': {'max': {'field': 'updated_on'}}}},
    });
    if (!response.aggregations.maxDate.value_as_string) {
      return null;
    }
    return new Date(response.aggregations.maxDate.value_as_string);
  }

  static getBulkUpsertBody(index, type, data) {
    return data.reduce((acum, value) => {
      const updateAction = {
        'update': { '_index': index, '_type': type, '_id': value.id },
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