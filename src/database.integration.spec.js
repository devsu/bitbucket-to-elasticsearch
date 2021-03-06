const _ = require('lodash');
const elasticsearch = require('elasticsearch');
const helper = require('../integration-tests/helper');
const Database = require('./database');
const repositoryData = require('../integration-tests/repository-es');
const commitData = require('../integration-tests/commit-es');
const statusData = require('../integration-tests/status-es');
const refData = require('../integration-tests/ref-branch-es');

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
      test('should create indexes', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
        const existsRepositories = await elastic.indices.exists({'index': 'repositories'});
        const existsCommits = await elastic.indices.exists({'index': 'commits'});
        const existsStatuses = await elastic.indices.exists({'index': 'statuses'});
        const existsRefs = await elastic.indices.exists({'index': 'refs'});
        const existsDeployments = await elastic.indices.exists({'index': 'deployments'});
        expect(existsRepositories).toEqual(true);
        expect(existsCommits).toEqual(true);
        expect(existsStatuses).toEqual(true);
        expect(existsRefs).toEqual(true);
        expect(existsDeployments).toEqual(true)
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

    describe('when statuses index already exists', () => {
      beforeEach(async() => {
        await elastic.indices.create({'index': 'statuses'});
        await elastic.indices.flush({'waitIfOngoing': true});
      });

      test('should not fail', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
      });
    });

    describe('when refs index already exists', () => {
      beforeEach(async() => {
        await elastic.indices.create({'index': 'refs'});
        await elastic.indices.flush({'waitIfOngoing': true});
      });

      test('should not fail', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
      });
    });

    describe('when deployments index already exists', () => {
      beforeEach(async() => {
        await elastic.indices.create({'index': 'deployments'});
        await elastic.indices.flush({'waitIfOngoing': true});
      });

      test('should not fail', async() => {
        await database.setup();
        await elastic.indices.flush({'waitIfOngoing': true});
      });
    });
  });

  describe('reset()', () => {

    beforeEach(async() => {
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    test('should remove all repositories from database', async() => {
      await database.reset();
      try {
        await elastic.search({'index': 'repositories', 'type': 'repository'});
        fail('should fail');
      } catch (e) {
        expect(e.message).toContain('no such index');
      }
    });

    test('should remove all commits from database', async() => {
      await database.reset();
      try {
        await elastic.search({'index': 'commits', 'type': 'commit'});
        fail('should fail');
      } catch (e) {
        expect(e.message).toContain('no such index');
      }
    });

    test('should remove all statuses from database', async() => {
      await database.reset();
      try {
        await elastic.search({'index': 'statuses', 'type': 'status'});
        fail('should fail');
      } catch (e) {
        expect(e.message).toContain('no such index');
      }
    });

    test('should remove all refs from database', async() => {
      await database.reset();
      try {
        await elastic.search({'index': 'refs', 'type': 'ref'});
        fail('should fail');
      } catch (e) {
        expect(e.message).toContain('no such index');
      }
    });

    test('should remove all deployments from database', async() => {
      await database.reset();
      try {
        await elastic.search({'index': 'deployments', 'type': 'deployment'});
        fail('should fail');
      } catch (e) {
        expect(e.message).toContain('no such index');
      }
    });
  });

  describe('saveRepositories()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, repositoryData, {'uuid': '{first}'});
      const second = Object.assign({}, repositoryData, {'uuid': '{second}'});
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
            '_id': dataItem.uuid,
            '_source': dataItem,
          });
        }));
        await database.saveRepositories(data);
        const response = await elastic.search({'index': 'repositories', 'type': 'repository'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveRepositories(data);
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.owner = 'c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.uuid,
            '_source': dataItem,
          });
        }));
        await database.saveRepositories(data);
        const response = await elastic.search({'index': 'repositories', 'type': 'repository'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('saveCommits()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, commitData, {'hash': 'first'});
      const second = Object.assign({}, commitData, {'hash': 'second'});
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
            '_id': dataItem.hash,
            '_source': dataItem,
          });
        }));
        await database.saveCommits(data);
        const response = await elastic.search({'index': 'commits', 'type': 'commit'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveCommits(data);
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.message = 'changed by c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.hash,
            '_source': dataItem,
          });
        }));
        await database.saveCommits(data);
        const response = await elastic.search({'index': 'commits', 'type': 'commit'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('saveStatuses()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, statusData, {'id': 'first'});
      const second = Object.assign({}, statusData, {'id': 'second'});
      data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data passed', () => {
      test('should fail', async() => {
        try {
          await database.saveStatuses();
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
        await database.saveStatuses(data);
        const response = await elastic.search({'index': 'statuses', 'type': 'status'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveStatuses(data);
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.description = 'changed by c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveStatuses(data);
        const response = await elastic.search({'index': 'statuses', 'type': 'status'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('saveRefs()', () => {
    let data;

    beforeEach(async() => {
      const first = Object.assign({}, refData, {'id': 'devsu/repo1#master'});
      const second = Object.assign({}, refData, {'id': 'devsu/repo1#v1.0'});
      data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data passed', () => {
      test('should fail', async() => {
        try {
          await database.saveRefs();
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
        await database.saveRefs(data);
        const response = await elastic.search({'index': 'refs', 'type': 'ref'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });

    describe('when a document already exists in the DB', () => {
      beforeEach(async() => {
        await database.saveRefs(data);
      });

      test('should update the document', async() => {
        data.forEach((dataItem) => {
          dataItem.description = 'changed by c3s4r';
        });
        const expectedData = expect.arrayContaining(data.map((dataItem) => {
          return expect.objectContaining({
            '_id': dataItem.id,
            '_source': dataItem,
          });
        }));
        await database.saveRefs(data);
        const response = await elastic.search({'index': 'refs', 'type': 'ref'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('saveDeployments()', () => {
    let data;

    beforeEach(async() => {
      const first = {'id': 'first'};
      const second = {'id': 'second'};
      data = [first, second];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data passed', () => {
      test('should fail', async() => {
        try {
          await database.saveDeployments();
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
        await database.saveDeployments(data);
        const response = await elastic.search({'index': 'deployments', 'type': 'deployment'});
        expect(response.hits.total).toEqual(2);
        expect(response.hits.hits).toEqual(expectedData);
      });
    });
  });

  describe('getRepository()', () => {
    beforeEach(async() => {
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data', () => {
      test('should return null', async() => {
        const actual = await database.getRepository(repositoryData.uuid);
        expect(actual).toBeNull();
      });
    });

    describe('when there is data', () => {
      beforeEach(async() => {
        await database.saveRepositories([repositoryData]);
      });

      test('should return the repo', async() => {
        const actual = await database.getRepository(repositoryData.uuid);
        expect(actual).toEqual(repositoryData);
      });
    });
  });

  describe('getCommit()', () => {
    beforeEach(async() => {
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data', () => {
      test('should return null', async() => {
        const actual = await database.getCommit(commitData.hash);
        expect(actual).toBeNull();
      });
    });

    describe('when there is data', () => {
      beforeEach(async() => {
        await database.saveCommits([commitData]);
      });

      test('should return the commit', async() => {
        const actual = await database.getCommit(commitData.hash);
        expect(actual).toEqual(commitData);
      });
    });
  });

  describe('getCommitAncestors()', () => {
    beforeEach(async() => {
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
    });

    describe('when no data', () => {
      test('should return an empty array', async() => {
        const actual = await database.getCommitAncestors(commitData.hash);
        expect(actual).toEqual([]);
      });
    });

    describe('when there is data', () => {
      let data, a, b, c, d, e, f, g, h, i, j;

      beforeEach(async() => {
        const isoDate = new Date().toISOString();
        a = Object.assign({}, commitData, {'hash': 'a', 'parents': ['b']});
        b = Object.assign({}, commitData, {'hash': 'b', 'parents': ['c', 'd', 'i']});
        c = Object.assign({}, commitData, {'hash': 'c', 'parents': ['e']});
        d = Object.assign({}, commitData, {'hash': 'd', 'parents': ['f']});
        e = Object.assign({}, commitData, {'hash': 'e', 'parents': ['g']});
        f = Object.assign({}, commitData, {'hash': 'f', 'parents': ['g']});
        g = Object.assign({}, commitData, {'hash': 'g', 'parents': []});
        h = Object.assign({}, commitData, {'hash': 'h', 'parents': ['g']});
        i = Object.assign({}, commitData, {'hash': 'i', 'parents': ['j'], 'firstSuccessfulBuildDate': isoDate});
        j = Object.assign({}, commitData, {'hash': 'j', 'parents': ['g'], 'firstSuccessfulBuildDate': isoDate});
        data = [a, b, c, d, e, f, g, h, i, j];
        await database.saveCommits(data);
      });

      test('should return the ancestors', async() => {
        const expectedElements = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'i', 'j'];
        const expected = expect.arrayContaining(expectedElements);
        const actual = await database.getCommitAncestors('a');
        expect(actual.length).toEqual(expectedElements.length);
        expect(actual).toEqual(expected);
      });

      describe('when sending a filter', () => {
        test('should return only the ancestors that matches the filter', async() => {
          const expectedElements = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
          const expected = expect.arrayContaining(expectedElements);
          const actual = await database.getCommitAncestors('a', (commit) => {
            return !commit.firstSuccessfulBuildDate;
          });
          expect(actual.length).toEqual(expectedElements.length);
          expect(actual).toEqual(expected);
        });
      });
    });
  });

  describe('getRepositories()', () => {
    let data, a, b;

    beforeEach(async() => {
      a = Object.assign({}, repositoryData, {'uuid': '{a}'});
      b = Object.assign({}, repositoryData, {'uuid': '{b}'});
      data = [a, b];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveRepositories(data);
    });

    test('should return all the repositories', async() => {
      const expectedData = expect.arrayContaining([a, b]);
      const response = await database.getRepositories();
      expect(response.length).toEqual(2);
      expect(response).toEqual(expectedData);
    });
  });

  describe('getStatuses()', () => {
    let data, a, b, c, d;

    beforeEach(async() => {
      a = Object.assign({}, statusData, {'id': 'a', 'state': 'FAILED', 'updated_on': '20200101T01:01:01'});
      b = Object.assign({}, statusData, {'id': 'b', 'updated_on': '20180101T01:01:01'});
      c = Object.assign({}, statusData, {'id': 'c', 'updated_on': '20190101T01:01:01'});
      d = Object.assign({}, statusData, {'id': 'd', 'updated_on': '20170101T01:01:01'});
      data = [a, b, c, d];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveStatuses(data);
    });

    test('should return the build statuses for the given repo', async() => {
      const expectedData = expect.arrayContaining([a, b, c, d]);
      const response = await database.getStatuses(statusData.repository.uuid);
      expect(response.length).toEqual(4);
      expect(response).toEqual(expectedData);
    });
  });

  describe('getRefs()', () => {
    let data, a, b, c, d;

    beforeEach(async() => {
      a = Object.assign(_.cloneDeep(refData), {'id': 'user/repo1#master', 'name': 'master'});
      b = Object.assign(_.cloneDeep(refData), {'id': 'user/repo1#v1.0', 'name': 'v1.0'});
      c = Object.assign(_.cloneDeep(refData), {'id': 'user/repo2#master', 'name': 'master'});
      d = Object.assign(_.cloneDeep(refData), {'id': 'user/repo2#v1.0', 'name': 'v1.0'});
      c.target.repository.uuid = d.target.repository.uuid = 'another';
      data = [a, b, c, d];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveRefs(data);
    });

    test('should return the refs for the given repo', async() => {
      const expectedData = expect.arrayContaining([a, b]);
      const response = await database.getRefs(refData.target.repository.uuid);
      expect(response.length).toEqual(2);
      expect(response).toEqual(expectedData);
    });
  });

  describe('updateCommits()', () => {
    let data, a, b, c;

    beforeEach(async() => {
      a = Object.assign({}, commitData, {'hash': 'a'});
      b = Object.assign({}, commitData, {'hash': 'b'});
      c = Object.assign({}, commitData, {'hash': 'c'});
      data = [a, b, c];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveCommits(data);
    });

    test('should update the matching documents', async() => {
      const updateInfo = {'message': 'changed'};
      const expectedA = a;
      const expectedB = Object.assign({}, b, updateInfo);
      const expectedC = Object.assign({}, c, updateInfo);
      await database.updateCommits(['b', 'c'], updateInfo);
      const actualA = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'a'});
      const actualB = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'b'});
      const actualC = await elastic.get({'index': 'commits', 'type': 'commit', 'id': 'c'});
      expect(actualA._source).toEqual(expectedA);
      expect(actualB._source).toEqual(expectedB);
      expect(actualC._source).toEqual(expectedC);
    });

    describe('when nothing to update', () => {
      test('should not fail', async() => {
        await database.updateCommits([], {});
      });
    });
  });

  describe('updateRepositories()', () => {
    let data, a, b, c;

    beforeEach(async() => {
      a = Object.assign({}, repositoryData, {'uuid': 'a'});
      b = Object.assign({}, repositoryData, {'uuid': 'b'});
      c = Object.assign({}, repositoryData, {'uuid': 'c'});
      data = [a, b, c];
      await database.setup();
      await elastic.indices.flush({'waitIfOngoing': true});
      await database.saveRepositories(data);
    });

    test('should update the matching documents', async() => {
      const updateInfo = {'message': 'changed'};
      const expectedA = a;
      const expectedB = Object.assign({}, b, updateInfo);
      const expectedC = Object.assign({}, c, updateInfo);
      await database.updateRepositories(['b', 'c'], updateInfo);
      const actualA = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': 'a'});
      const actualB = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': 'b'});
      const actualC = await elastic.get({'index': 'repositories', 'type': 'repository', 'id': 'c'});
      expect(actualA._source).toEqual(expectedA);
      expect(actualB._source).toEqual(expectedB);
      expect(actualC._source).toEqual(expectedC);
    });

    describe('when nothing to update', () => {
      test('should not fail', async() => {
        await database.updateRepositories([], {});
      });
    });
  });
});