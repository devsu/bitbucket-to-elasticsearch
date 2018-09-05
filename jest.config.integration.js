const config = require('./jest.config');
config.testRegex = '\\.integration\\.spec\\.js$';
module.exports = config;