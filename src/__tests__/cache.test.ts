import Redis from 'ioredis';
import { Cache } from '../cache';
import { CacheConfig } from '../types';

// Mock Redis for testing
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('Cache', () => {
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
      enableWarmup: false, // Disable warmup for basic tests
    };

    cache = Cache.getInstance(config);
  });

  afterEach(async () => {
    try {
      await cache.destroy();
    } catch {
      // Ignore cleanup errors
    }
    Cache.resetInstance();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const cache1 = Cache.getInstance();
      const cache2 = Cache.getInstance();
      expect(cache1).toBe(cache2);
    });

    it('should create new instance after reset', () => {
      const cache1 = Cache.getInstance();
      Cache.resetInstance();
      const cache2 = Cache.getInstance();
      expect(cache1).not.toBe(cache2);
    });
  });

  describe('set method', () => {
    it('should set a simple string value', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('frache:cache:test-key', 'test-value', 'EX', 3600);
    });

    it('should set a complex object value', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const testObject = { name: 'John', age: 30 };
      const result = await cache.set('user:1', testObject);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'frache:cache:user:1',
        JSON.stringify(testObject),
        'EX',
        3600
      );
    });

    it('should handle custom TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.set('temp-key', 'temp-value', { ttl: 300 });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('frache:cache:temp-key', 'temp-value', 'EX', 300);
    });

    it('should handle custom namespace', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.set('key', 'value', { namespace: 'custom' });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('frache:custom:key', 'value', 'EX', 3600);
    });

    it('should handle NX option', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.set('key', 'value', { nx: true });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('frache:cache:key', 'value', 'EX', 3600, 'NX');
    });

    it('should handle XX option', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.set('key', 'value', { xx: true });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('frache:cache:key', 'value', 'EX', 3600, 'XX');
    });

    it('should return false when Redis returns null', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await cache.set('key', 'value', { nx: true });

      expect(result).toBe(false);
    });

    it('should handle tags metadata', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.set('key', 'value', { tags: ['tag1', 'tag2'] });

      expect(result).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalledWith('frache:cache:key:meta', {
        compressed: false,
        tags: ['tag1', 'tag2'],
      });
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:key:meta', 3600);
    });

    it('should throw error for invalid key', async () => {
      await expect(cache.set('', 'value')).rejects.toThrow('Cache key must be a non-empty string');
      await expect(cache.set('a'.repeat(251), 'value')).rejects.toThrow('Cache key is too long');
    });
  });

  describe('get method', () => {
    it('should get a simple value', async () => {
      mockRedis.get.mockResolvedValue('test-value');
      mockRedis.hgetall.mockResolvedValue({});

      const result = await cache.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedis.get).toHaveBeenCalledWith('frache:cache:test-key');
    });

    it('should get a complex object', async () => {
      const testObject = { name: 'John', age: 30 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testObject));
      mockRedis.hgetall.mockResolvedValue({});

      const result = await cache.get('user:1');

      expect(result).toEqual(testObject);
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.hgetall.mockResolvedValue({});

      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return default value for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.hgetall.mockResolvedValue({});

      const result = await cache.get('non-existent', { defaultValue: 'default' });

      expect(result).toBe('default');
    });

    it('should handle custom namespace', async () => {
      mockRedis.get.mockResolvedValue('value');
      mockRedis.hgetall.mockResolvedValue({});

      const result = await cache.get('key', { namespace: 'custom' });

      expect(result).toBe('value');
      expect(mockRedis.get).toHaveBeenCalledWith('frache:custom:key');
    });

    it('should refresh TTL when requested', async () => {
      mockRedis.get.mockResolvedValue('value');
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.get('key', { refreshTtl: true, ttl: 1800 });

      expect(result).toBe('value');
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:key', 1800);
    });
  });

  describe('del method', () => {
    it('should delete a single key', async () => {
      mockRedis.del.mockResolvedValue(2); // key + meta key

      const result = await cache.del('test-key');

      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith(
        'frache:cache:test-key',
        'frache:cache:test-key:meta'
      );
    });

    it('should handle custom namespace', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.del('key', { namespace: 'custom' });

      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('frache:custom:key', 'frache:custom:key:meta');
    });

    it('should delete by pattern', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['frache:cache:user:1', 'frache:cache:user:2']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(4);

      const result = await cache.del('pattern', { pattern: 'user:*' });

      expect(result).toBe(4);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'frache:cache:user:*',
        'COUNT',
        100
      );
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await cache.del('pattern', { pattern: 'nonexistent:*' });

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('clear method', () => {
    it('should clear all keys in default namespace', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['frache:cache:key1', 'frache:cache:key2']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(4);

      const result = await cache.clear();

      expect(result).toBe(4);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'frache:cache:*', 'COUNT', 100);
    });

    it('should clear keys in custom namespace', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['frache:custom:key1']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(2);

      const result = await cache.clear({ namespace: 'custom' });

      expect(result).toBe(2);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'frache:custom:*', 'COUNT', 100);
    });

    it('should clear keys by pattern', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['frache:cache:user:1', 'frache:cache:user:2']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(4);

      const result = await cache.clear({ pattern: 'user:*' });

      expect(result).toBe(4);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'frache:cache:user:*',
        'COUNT',
        100
      );
    });

    it('should return 0 when no keys found', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await cache.clear();

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track cache statistics', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValueOnce('"value"').mockResolvedValueOnce(null);
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(1);

      // Perform operations
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key2'); // miss
      await cache.del('key1');

      const stats = cache.getStats();

      expect(stats.sets).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.deletes).toBe(1);
    });
  });
});
