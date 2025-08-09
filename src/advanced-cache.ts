import { Cache } from './cache';
import { CacheConfig, CacheOptions, SetOptions, GetOptions } from './types';

/**
 * Advanced caching features and utilities
 */
export class AdvancedCache extends Cache {
  private static advancedInstance: AdvancedCache | null = null;

  /**
   * Get singleton instance of AdvancedCache
   */
  public static override getInstance(config?: CacheConfig): AdvancedCache {
    if (!AdvancedCache.advancedInstance) {
      AdvancedCache.advancedInstance = new AdvancedCache(config);
    }
    return AdvancedCache.advancedInstance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  public static override resetInstance(): void {
    if (AdvancedCache.advancedInstance) {
      AdvancedCache.advancedInstance.destroy();
      AdvancedCache.advancedInstance = null;
    }
  }
  /**
   * Get or set a value with a factory function
   * If the key exists, return the cached value
   * If not, execute the factory function and cache the result
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: SetOptions = {}
  ): Promise<T> {
    // Try to get existing value
    const existing = await this.get<T>(key, options);

    if (existing !== null) {
      return existing;
    }

    // Execute factory function
    const value = await Promise.resolve(factory());

    // Cache the result
    await this.set(key, value, options);

    return value;
  }

  /**
   * Set multiple key-value pairs at once
   */
  public async setMany(
    entries: Array<{ key: string; value: any; options?: SetOptions }>,
    globalOptions: SetOptions = {}
  ): Promise<boolean[]> {
    const promises = entries.map(({ key, value, options }) =>
      this.set(key, value, { ...globalOptions, ...options })
    );

    return Promise.all(promises);
  }

  /**
   * Get multiple values at once
   */
  public async getMany<T = any>(
    keys: string[],
    options: GetOptions = {}
  ): Promise<Array<{ key: string; value: T | null }>> {
    const promises = keys.map(async (key) => ({
      key,
      value: await this.get<T>(key, options),
    }));

    return Promise.all(promises);
  }

  /**
   * Delete multiple keys at once
   */
  public async delMany(
    keys: string[],
    options: Omit<SetOptions, 'pattern'> = {}
  ): Promise<number> {
    let totalDeleted = 0;

    for (const key of keys) {
      totalDeleted += await this.del(key, options);
    }

    return totalDeleted;
  }

  /**
   * Check if a key exists in the cache
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * Get the TTL (time to live) of a key in seconds
   */
  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    return this.redis.ttl(cacheKey);
  }

  /**
   * Set the TTL of an existing key
   */
  public async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    const result = await this.redis.expire(cacheKey, ttl);
    return result === 1;
  }

  /**
   * Remove the TTL from a key (make it persistent)
   */
  public async persist(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    const result = await this.redis.persist(cacheKey);
    return result === 1;
  }

  /**
   * Increment a numeric value in the cache
   */
  public async increment(
    key: string,
    amount = 1,
    options: SetOptions = {}
  ): Promise<number> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    const result = await this.redis.incrby(cacheKey, amount);

    // Set TTL if specified
    const ttl = options.ttl || this.config.defaultTtl;
    if (ttl > 0) {
      await this.redis.expire(cacheKey, ttl);
    }

    return result;
  }

  /**
   * Decrement a numeric value in the cache
   */
  public async decrement(
    key: string,
    amount = 1,
    options: SetOptions = {}
  ): Promise<number> {
    return this.increment(key, -amount, options);
  }

  /**
   * Add an item to a list (left push)
   */
  public async listPush(
    key: string,
    value: any,
    options: SetOptions = {}
  ): Promise<number> {
    const cacheKey = this.generateCacheKey(key, options.namespace);
    const serializedValue = this.serializeValue(value);

    const result = await this.redis.lpush(cacheKey, serializedValue);

    // Set TTL if specified
    const ttl = options.ttl || this.config.defaultTtl;
    if (ttl > 0) {
      await this.redis.expire(cacheKey, ttl);
    }

    return result;
  }

  /**
   * Remove and return an item from a list (left pop)
   */
  public async listPop<T = any>(
    key: string,
    options: GetOptions = {}
  ): Promise<T | null> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    const result = await this.redis.lpop(cacheKey);

    if (result === null) {
      return null;
    }

    return this.deserializeValue(result);
  }

  /**
   * Get the length of a list
   */
  public async listLength(key: string, options: CacheOptions = {}): Promise<number> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    return this.redis.llen(cacheKey);
  }

  /**
   * Add an item to a set
   */
  public async setAdd(
    key: string,
    value: any,
    options: SetOptions = {}
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options.namespace);
    const serializedValue = this.serializeValue(value);

    const result = await this.redis.sadd(cacheKey, serializedValue);

    // Set TTL if specified
    const ttl = options.ttl || this.config.defaultTtl;
    if (ttl > 0) {
      await this.redis.expire(cacheKey, ttl);
    }

    return result === 1;
  }

  /**
   * Remove an item from a set
   */
  public async setRemove(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options.namespace);
    const serializedValue = this.serializeValue(value);

    const result = await this.redis.srem(cacheKey, serializedValue);
    return result === 1;
  }

  /**
   * Check if an item exists in a set
   */
  public async setContains(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options.namespace);
    const serializedValue = this.serializeValue(value);

    const result = await this.redis.sismember(cacheKey, serializedValue);
    return result === 1;
  }

  /**
   * Get all items in a set
   */
  public async setMembers<T = any>(
    key: string,
    options: GetOptions = {}
  ): Promise<T[]> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    const members = await this.redis.smembers(cacheKey);
    return members.map(member => this.deserializeValue(member));
  }

  /**
   * Get the size of a set
   */
  public async setSize(key: string, options: CacheOptions = {}): Promise<number> {
    const cacheKey = this.generateCacheKey(key, options.namespace);

    return this.redis.scard(cacheKey);
  }

}
