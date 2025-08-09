import Redis from 'ioredis';
import { AdvancedCache } from '../advanced-cache';
import { CacheConfig } from '../types';

// Mock Redis for testing
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('AdvancedCache', () => {
  let mockRedis: jest.Mocked<Redis>;
  let cache: AdvancedCache;

  beforeEach(() => {
    // Reset cache instance before each test
    AdvancedCache.resetInstance();

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
      ttl: jest.fn(),
      persist: jest.fn(),
      incrby: jest.fn(),
      lpush: jest.fn(),
      lpop: jest.fn(),
      llen: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      sismember: jest.fn(),
      smembers: jest.fn(),
      scard: jest.fn(),
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    const config: CacheConfig = {
      redis: mockRedis,
      defaultTtl: 3600,
      enableWarmup: false,
    };

    cache = AdvancedCache.getInstance(config) as AdvancedCache;
  });

  afterEach(async () => {
    try {
      await cache.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
    AdvancedCache.resetInstance();
    jest.clearAllMocks();
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      mockRedis.get.mockResolvedValue('cached-value');
      mockRedis.hgetall.mockResolvedValue({});

      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('test-key', factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should execute factory and cache result if key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.set.mockResolvedValue('OK');

      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('test-key', factory);

      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'frache:cache:test-key',
        'new-value',
        'EX',
        3600
      );
    });
  });

  describe('setMany', () => {
    it('should set multiple key-value pairs', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const entries = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', options: { ttl: 1800 } },
      ];

      const results = await cache.setMany(entries);

      expect(results).toEqual([true, true]);
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenNthCalledWith(
        1,
        'frache:cache:key1',
        'value1',
        'EX',
        3600
      );
      expect(mockRedis.set).toHaveBeenNthCalledWith(
        2,
        'frache:cache:key2',
        'value2',
        'EX',
        1800
      );
    });
  });

  describe('getMany', () => {
    it('should get multiple values', async () => {
      mockRedis.get
        .mockResolvedValueOnce('value1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('value3');
      mockRedis.hgetall.mockResolvedValue({});

      const results = await cache.getMany(['key1', 'key2', 'key3']);

      expect(results).toEqual([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: null },
        { key: 'key3', value: 'value3' },
      ]);
    });
  });

  describe('TTL operations', () => {
    it('should get TTL of a key', async () => {
      mockRedis.ttl.mockResolvedValue(1800);

      const ttl = await cache.ttl('test-key');

      expect(ttl).toBe(1800);
      expect(mockRedis.ttl).toHaveBeenCalledWith('frache:cache:test-key');
    });

    it('should set TTL of a key', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.expire('test-key', 1800);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:test-key', 1800);
    });

    it('should persist a key (remove TTL)', async () => {
      mockRedis.persist.mockResolvedValue(1);

      const result = await cache.persist('test-key');

      expect(result).toBe(true);
      expect(mockRedis.persist).toHaveBeenCalledWith('frache:cache:test-key');
    });
  });

  describe('Numeric operations', () => {
    it('should increment a value', async () => {
      mockRedis.incrby.mockResolvedValue(5);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.increment('counter', 2);

      expect(result).toBe(5);
      expect(mockRedis.incrby).toHaveBeenCalledWith('frache:cache:counter', 2);
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:counter', 3600);
    });

    it('should decrement a value', async () => {
      mockRedis.incrby.mockResolvedValue(3);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.decrement('counter', 2);

      expect(result).toBe(3);
      expect(mockRedis.incrby).toHaveBeenCalledWith('frache:cache:counter', -2);
    });
  });

  describe('List operations', () => {
    it('should push to a list', async () => {
      mockRedis.lpush.mockResolvedValue(3);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.listPush('my-list', 'item1');

      expect(result).toBe(3);
      expect(mockRedis.lpush).toHaveBeenCalledWith('frache:cache:my-list', 'item1');
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:my-list', 3600);
    });

    it('should pop from a list', async () => {
      (mockRedis.lpop as any).mockResolvedValue('item1');

      const result = await cache.listPop('my-list');

      expect(result).toBe('item1');
      expect(mockRedis.lpop).toHaveBeenCalledWith('frache:cache:my-list');
    });

    it('should return null when popping from empty list', async () => {
      (mockRedis.lpop as any).mockResolvedValue(null);

      const result = await cache.listPop('empty-list');

      expect(result).toBeNull();
    });

    it('should get list length', async () => {
      mockRedis.llen.mockResolvedValue(5);

      const result = await cache.listLength('my-list');

      expect(result).toBe(5);
      expect(mockRedis.llen).toHaveBeenCalledWith('frache:cache:my-list');
    });
  });

  describe('Set operations', () => {
    it('should add to a set', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.setAdd('my-set', 'item1');

      expect(result).toBe(true);
      expect(mockRedis.sadd).toHaveBeenCalledWith('frache:cache:my-set', 'item1');
      expect(mockRedis.expire).toHaveBeenCalledWith('frache:cache:my-set', 3600);
    });

    it('should remove from a set', async () => {
      mockRedis.srem.mockResolvedValue(1);

      const result = await cache.setRemove('my-set', 'item1');

      expect(result).toBe(true);
      expect(mockRedis.srem).toHaveBeenCalledWith('frache:cache:my-set', 'item1');
    });

    it('should check if item exists in set', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await cache.setContains('my-set', 'item1');

      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith('frache:cache:my-set', 'item1');
    });

    it('should get all set members', async () => {
      mockRedis.smembers.mockResolvedValue(['item1', 'item2', '{"name":"John"}']);

      const result = await cache.setMembers('my-set');

      expect(result).toEqual(['item1', 'item2', { name: 'John' }]);
      expect(mockRedis.smembers).toHaveBeenCalledWith('frache:cache:my-set');
    });

    it('should get set size', async () => {
      mockRedis.scard.mockResolvedValue(3);

      const result = await cache.setSize('my-set');

      expect(result).toBe(3);
      expect(mockRedis.scard).toHaveBeenCalledWith('frache:cache:my-set');
    });
  });
});
