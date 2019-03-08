#!/usr/bin/env node

const config = require('./src/config');
const Sync = require('./src/sync');
const logger = require('./src/logger');
const log = logger.child({'class': 'index.js'});
const program = require('commander');
const Database = require('./src/database');

const databaseConfig = config.elasticsearch;

const startRepoSync = async() => {
  const sync = new Sync(config);
  await sync.execute();
};

const resetDatabase = async() => {
  const database = new Database(databaseConfig);
  await database.reset()
};

process.on('unhandledRejection', (error) => {
  log.error(error, error.message);
  log.error('Unhandled Rejection. Terminating process');
  process.exit(1);
});


program
  .command('start')
  .action(startRepoSync);

program
  .command('reset')
  .action(resetDatabase);


program.parse(process.argv);