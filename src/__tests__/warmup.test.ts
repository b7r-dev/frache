import Redis from 'ioredis';
import { Cache } from '../cache';
import { CacheConfig, WarmupTask } from '../types';

// Mock Redis for testing
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('Cache Warmup Tasks', () => {
  let mockRedis: jest.Mocked<Redis>;
  let cache: Cache;

  beforeEach(() => {
    // Reset cache instance before each test
    Cache.resetInstance();
    
    // Create a mock Redis instance
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      expire: jest.fn(),
      scan: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      status: 'ready',
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    
    const config: CacheConfig = {
      redis: mockRedis,
      defaultTtl: 3600,
      enableWarmup: true,
      warmupInterval: 100, // Short interval for testing
    };
    
    cache = Cache.getInstance(config);
  });

  afterEach(async () => {
    try {
      await cache.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
    Cache.resetInstance();
    jest.clearAllMocks();
  });

  describe('registerWarmupTask', () => {
    it('should register a warmup task', () => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test warmup task',
        execute: jest.fn(),
        priority: 1,
      };

      cache.registerWarmupTask(task);

      // Verify task was registered by trying to queue it
      const queued = cache.queueWarmupTask('test-task');
      expect(queued).toBe(true);
    });

    it('should emit warmup event when task is registered', (done) => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.on('warmup', (event) => {
        expect(event.key).toBe('test-task');
        expect(event.data.status).toBe('registered');
        expect(event.data.task).toEqual(task);
        done();
      });

      cache.registerWarmupTask(task);
    });
  });

  describe('unregisterWarmupTask', () => {
    it('should unregister a warmup task', () => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.registerWarmupTask(task);
      const removed = cache.unregisterWarmupTask('test-task');

      expect(removed).toBe(true);

      // Verify task was removed by trying to queue it
      expect(() => cache.queueWarmupTask('test-task')).toThrow(
        "Warmup task with id 'test-task' not found"
      );
    });

    it('should return false when trying to unregister non-existent task', () => {
      const removed = cache.unregisterWarmupTask('non-existent');
      expect(removed).toBe(false);
    });

    it('should emit warmup event when task is unregistered', (done) => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.registerWarmupTask(task);

      cache.on('warmup', (event) => {
        if (event.data.status === 'unregistered') {
          expect(event.key).toBe('test-task');
          done();
        }
      });

      cache.unregisterWarmupTask('test-task');
    });
  });

  describe('queueWarmupTask', () => {
    it('should queue a registered warmup task', () => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.registerWarmupTask(task);
      const queued = cache.queueWarmupTask('test-task');

      expect(queued).toBe(true);
    });

    it('should throw error when trying to queue non-existent task', () => {
      expect(() => cache.queueWarmupTask('non-existent')).toThrow(
        "Warmup task with id 'non-existent' not found"
      );
    });

    it('should not queue the same task twice', () => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.registerWarmupTask(task);
      const queued1 = cache.queueWarmupTask('test-task');
      const queued2 = cache.queueWarmupTask('test-task');

      expect(queued1).toBe(true);
      expect(queued2).toBe(false);
    });

    it('should apply queue options to task', () => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
        priority: 1,
      };

      cache.registerWarmupTask(task);
      cache.queueWarmupTask('test-task', { priority: 5 });

      // We can't directly test the internal queue, but we can verify the task was queued
      expect(cache.queueWarmupTask('test-task')).toBe(false); // Already queued
    });

    it('should emit warmup event when task is queued', (done) => {
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: jest.fn(),
      };

      cache.registerWarmupTask(task);

      cache.on('warmup', (event) => {
        if (event.data.status === 'queued') {
          expect(event.key).toBe('test-task');
          expect(event.data.task).toEqual(task);
          done();
        }
      });

      cache.queueWarmupTask('test-task');
    });
  });

  describe('runWarmupTask', () => {
    it('should run a warmup task immediately', async () => {
      const executeFn = jest.fn().mockResolvedValue(undefined);
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: executeFn,
      };

      cache.registerWarmupTask(task);
      await cache.runWarmupTask('test-task');

      expect(executeFn).toHaveBeenCalledTimes(1);
    });

    it('should throw error when trying to run non-existent task', async () => {
      await expect(cache.runWarmupTask('non-existent')).rejects.toThrow(
        "Warmup task with id 'non-existent' not found"
      );
    });

    it('should emit warmup events during task execution', (done) => {
      const executeFn = jest.fn().mockResolvedValue(undefined);
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: executeFn,
      };

      cache.registerWarmupTask(task);

      let eventCount = 0;
      cache.on('warmup', (event) => {
        if (event.key === 'test-task') {
          eventCount++;
          if (event.data.status === 'started') {
            expect(event.data.task).toEqual(task);
          } else if (event.data.status === 'completed') {
            expect(event.data.duration).toBeGreaterThanOrEqual(0);
            expect(eventCount).toBe(2); // started + completed
            done();
          }
        }
      });

      cache.runWarmupTask('test-task');
    });

    it('should handle task execution errors', (done) => {
      const error = new Error('Task failed');
      const executeFn = jest.fn().mockRejectedValue(error);
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: executeFn,
      };

      cache.registerWarmupTask(task);

      cache.on('warmup', (event) => {
        if (event.key === 'test-task' && event.data.status === 'failed') {
          expect(event.data.error).toBe(error);
          expect(event.data.duration).toBeGreaterThanOrEqual(0);
          done();
        }
      });

      cache.runWarmupTask('test-task');
    });

    it('should handle task timeout', (done) => {
      const executeFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      const task: WarmupTask = {
        id: 'test-task',
        name: 'Test Task',
        execute: executeFn,
        timeout: 50, // Short timeout
      };

      cache.registerWarmupTask(task);

      cache.on('warmup', (event) => {
        if (event.key === 'test-task' && event.data.status === 'failed') {
          expect(event.data.error.message).toBe('Task timeout');
          done();
        }
      });

      cache.runWarmupTask('test-task');
    }, 1000);
  });
});
