#!/usr/bin/env node

const path = require('path');
const config = require(path.join(process.cwd(), 'config'));
const Sync = require('./src/sync');

const startRepoSync = async() => {
  const sync = new Sync(config);
  try {
    await sync.execute();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

startRepoSync();
