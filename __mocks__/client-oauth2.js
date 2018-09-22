const instance = {
  'credentials': {
    'getToken': jest.fn(() => {
      return {
        'accessToken': 'my-token',
      };
    }),
  },
};

const constructorArgs = [];

module.exports = class {
  constructor() {
    constructorArgs.push(Array.from(arguments));
    return instance;
  }

  static mockGetConstructorArgs() {
    return constructorArgs;
  }
};