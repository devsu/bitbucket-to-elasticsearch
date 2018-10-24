#!/usr/bin/env node

const config = require('./src/config');
const Sync = require('./src/sync');
const logger = require('./src/logger');
const log = logger.child({'class': 'index.js'});

const startRepoSync = async() => {
  const sync = new Sync(config);
  await sync.execute();
};

process.on('unhandledRejection', (error) => {
  log.error(error, error.message);
  log.error('Unhandled Rejection. Terminating process');
  process.exit(1);
});

startRepoSync();