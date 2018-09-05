module.exports = class BitbucketSync {
  constructor(options) {
    if (!options || !options.username) {
      throw new Error('options.username is required');
    }
  }

  async execute(options) {
    const api = this._getAxiosInstance();
    const response = await api.get('/teams/devsu/projects/');
    console.log(JSON.stringify(response.data));
  }
};

// const bitbucketSync = new BitbucketSync({
//   'clientId': 'SyWP9n6dDbsLZsSR7x',
//   'clientSecret': 'REj5A9PPbRpKPQUdBhUnpuZjA4DddFk3',
// });
//
// bitbucketSync.execute({
//
// });