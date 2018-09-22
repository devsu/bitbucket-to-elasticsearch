const PQueue = require('p-queue');

const queues = {};

class Queue {
  static getInstance(name, options) {
    if (!name) {
      throw new Error('name is required')
    }
    if (queues[name]) {
      return queues[name];
    }
    const queue = new PQueue(options);
    queue.name = name;
    queues[name] = queue;
    return queue;
  }
}

module.exports = Queue;