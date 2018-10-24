const _ = require('lodash');
const PQueue = require('p-queue');

const queues = {};

class Queue {
  static getQueue(name, options) {
    if (!name) {
      throw new Error('name is required')
    }
    if (queues[name]) {
      return queues[name];
    }
    const optionsWithoutUndefinedValues = _.pickBy(options, (value) => !!value);
    const queue = new PQueue(optionsWithoutUndefinedValues);
    queue.name = name;
    queues[name] = queue;
    return queue;
  }
}

module.exports = Queue;