const Queue = require('./queue');

describe('Queue', () => {
  let queue;

  describe('getQueue()', () => {
    describe('when no name', () => {
      test('should fail', () => {
        try {
          queue = Queue.getQueue();
          fail('should fail');
        } catch (e) {
          expect(e.message).toEqual('name is required');
        }
      });
    });

    test('should return queue with the defined name', () => {
      const queue = Queue.getQueue('commits');
      expect(queue.add).toBeDefined();
      expect(queue.name).toEqual('commits');
    });

    test('should return a unique queue', () => {
      const queue1 = Queue.getQueue('commits');
      const queue2 = Queue.getQueue('commits');
      expect(queue1).toBe(queue2);
    });

    test('queue should be configured with the corresponding options', () => {
      const queue = Queue.getQueue('another', {'concurrency': 10});
      expect(queue._concurrency).toEqual(10);
    });
  });
});