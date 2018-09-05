const instance = {
  'credentials': {
    'getToken': jest.fn(() => {
      return {
        'accessToken': 'my-token',
      };
    }),
  },
};

module.exports = class {
  constructor() {
    return instance;
  }
};