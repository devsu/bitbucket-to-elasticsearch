const elasticsearch = require('elasticsearch');
const helper = require('../integration-tests/helper');
const Database = require('./database');
const repositoryData = require('../integration-tests/repository-es');
const commitData = require('../integration-tests/commit-es');

describe('Database integration tests', () => {
  let database, elastic, elasticConfig;

  beforeAll(async() => {
    jest.setTimeout(20000);
    const host = await helper.getHost();
    const port = await helper.getExternalPort('elasticsearch', 9200);
    elasticConfig = {
      'host': `${host}:${port}`,
      // 'log': 'debug',
    };
    elastic = new elasticsearch.Client(Object.assign({}, elasticConfig));
  });

  beforeEach(async() => {
    database = new Database(elasticConfig);
    await elastic.indices.delete({'index': '_all'});
    await elastic.indices.flush({'waitIfOngoing': true});
  });

  describe('setup()', () => {
    describe('when database is empty', () => {
      test('should create repositories and commits indexes', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
        const existsRepositories = await elastic.indices.exists({'index': 'repositories'});
        const existsCommits = await elastic.indices.exists({'index': 'commits'});
        expect(existsRepositories).toEqual(true);
        expect(existsCommits).toEqual(true);
      });
    });

    describe('when repositories index already exists', () => {
      beforeEach(async() => {
        await elastic.indices.create({'index': 'repositories'});
        await elastic.indices.flush({'waitIfOngoing': true});
      });

      test('should not fail', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
      });
    });

    describe('when commits index already exists', () => {
      beforeEach(async() => {
        await elastic.indices.create({'index': 'commits'});
        await elastic.indices.flush({'waitIfOngoing': true});
      });

      test('should not fail', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
      });
    });
  });

  describe('saveRepositories()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, repositoryData, {'id': 'first'});
      const second = Object.assign({}, repositoryData, {'id': 'second'});
      data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data passed', () => {
      test('should fail', async() => {
        try {
          await database.saveRepositories();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('data is required');
        }
      });
    });

    describe('when a document does not exist in the DB', () => {
      test('should insert the document', async() => {
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveRepositories(data);
        await elastic.indices.refresh();
        const response = await elastic.search({'index': 'repositories', 'type': 'repository'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveRepositories(data);
        await elastic.indices.refresh();
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.owner = 'c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveRepositories(data);
        await elastic.indices.refresh();
        const response = await elastic.search({'index': 'repositories', 'type': 'repository'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('saveCommits()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, commitData, {'id': 'first'});
      const second = Object.assign({}, commitData, {'id': 'second'});
      data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data passed', () => {
      test('should fail', async() => {
        try {
          await database.saveCommits();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('data is required');
        }
      });
    });

    describe('when a document does not exist in the DB', () => {
      test('should insert the document', async() => {
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveCommits(data);
        await elastic.indices.refresh();
        const response = await elastic.search({'index': 'commits', 'type': 'commit'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveCommits(data);
        await elastic.indices.refresh();
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.message = 'changed by c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveCommits(data);
        await elastic.indices.refresh();
        const response = await elastic.search({'index': 'commits', 'type': 'commit'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('getRepositoriesMaxDate()', () => {
    let expectedDate;

    beforeEach(async() => {
      expectedDate = new Date().toISOString();
      const first = Object.assign({}, repositoryData, {'id': 'first', 'updated_on': expectedDate});
      const second = Object.assign({}, repositoryData, {'id': 'second'});
      const data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveRepositories(data);
      await elastic.indices.refresh();
    });

    test('should return the max updated_on date of repositories', async() => {
      const actual = await database.getRepositoriesMaxDate();
      expect(actual).toEqual(expectedDate);
    });
  });
});