import { EventEmitter } from 'events';
import Redis from 'ioredis';
import {
  CacheConfig,
  SetOptions,
  GetOptions,
  DelOptions,
  ClearOptions,
  WarmupTask,
  QueueWarmupOptions,
  CacheStats,
  CacheEvent,
  CacheEventListener,
  CacheEventType,
} from './types';
import {
  generateCacheKey,
  serialize,
  deserialize,
  compress,
  decompress,
  shouldCompress,
  generateScanPattern,
  parseTtl,
  validateKey,
} from './utils';

/**
 * Advanced caching class with Redis backend and intelligent features
 */
export class Cache extends EventEmitter {
  private static instance: Cache | null = null;
  protected redis: Redis;
  protected config: Required<CacheConfig>;
  private stats: CacheStats;
  private warmupTasks: Map<string, WarmupTask>;
  private warmupQueue: WarmupTask[];
  private warmupInterval: NodeJS.Timeout | null = null;
  private isProcessingWarmup = false;

  protected constructor(config: CacheConfig = {}) {
    super();

    this.config = {
      redis: config.redis || new Redis(config.redisOptions || {}),
      redisOptions: config.redisOptions || {},
      defaultTtl: config.defaultTtl || 3600, // 1 hour
      defaultNamespace: config.defaultNamespace || 'cache',
      enableCompression: config.enableCompression || true,
      maxMemory: config.maxMemory || 100 * 1024 * 1024, // 100MB
      keyPrefix: config.keyPrefix || 'frache',
      enableWarmup: config.enableWarmup || true,
      warmupInterval: config.warmupInterval || 60000, // 1 minute
    };

    this.redis = this.config.redis;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };

    this.warmupTasks = new Map();
    this.warmupQueue = [];

    this.setupRedisEventHandlers();

    if (this.config.enableWarmup) {
      this.startWarmupProcessor();
    }
  }

  /**
   * Get singleton instance of Cache
   */
  public static getInstance(config?: CacheConfig): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache(config);
    }
    return Cache.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (Cache.instance) {
      Cache.instance.destroy();
      Cache.instance = null;
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupRedisEventHandlers(): void {
    this.redis.on('error', (error) => {
      this.stats.errors++;
      this.emitEvent('error', undefined, undefined, { error });
    });

    this.redis.on('connect', () => {
      this.emit('connected');
    });

    this.redis.on('ready', () => {
      this.emit('ready');
    });
  }

  /**
   * Emit cache event
   */
  private emitEvent(
    type: CacheEventType,
    key?: string,
    namespace?: string,
    data?: any
  ): void {
    const event: CacheEvent = {
      type,
      timestamp: new Date(),
      ...(key && { key }),
      ...(namespace && { namespace }),
      ...(data && { data }),
    };

    this.emit('cacheEvent', event);
    this.emit(type, event);
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Add event listener for cache events
   */
  public onCacheEvent(listener: CacheEventListener): void {
    this.on('cacheEvent', listener);
  }

  /**
   * Remove event listener for cache events
   */
  public offCacheEvent(listener: CacheEventListener): void {
    this.off('cacheEvent', listener);
  }

  /**
   * Start warmup task processor
   */
  private startWarmupProcessor(): void {
    if (this.warmupInterval) {
      return;
    }

    this.warmupInterval = setInterval(() => {
      void this.processWarmupQueue();
    }, this.config.warmupInterval);
  }

  /**
   * Stop warmup task processor
   */
  private stopWarmupProcessor(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
  }

  /**
   * Process warmup queue
   */
  private async processWarmupQueue(): Promise<void> {
    if (this.isProcessingWarmup || this.warmupQueue.length === 0) {
      return;
    }

    this.isProcessingWarmup = true;

    try {
      // Sort by priority (higher priority first)
      this.warmupQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      const task = this.warmupQueue.shift();
      if (task) {
        await this.executeWarmupTask(task);
      }
    } catch (error) {
      this.emitEvent('error', undefined, undefined, { error });
    } finally {
      this.isProcessingWarmup = false;
    }
  }

  /**
   * Execute a warmup task
   */
  private async executeWarmupTask(task: WarmupTask): Promise<void> {
    const startTime = Date.now();

    try {
      this.emitEvent('warmup', task.id, undefined, { task, status: 'started' });

      if (task.timeout) {
        await Promise.race([
          Promise.resolve(task.execute()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeout)
          ),
        ]);
      } else {
        await Promise.resolve(task.execute());
      }

      const duration = Date.now() - startTime;
      this.emitEvent('warmup', task.id, undefined, {
        task,
        status: 'completed',
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emitEvent('warmup', task.id, undefined, {
        task,
        status: 'failed',
        duration,
        error
      });

      if (task.retry && task.retryAttempts && task.retryAttempts > 0) {
        // Implement retry logic here if needed
        // For now, we'll just log the error
        console.error(`Warmup task ${task.id} failed:`, error);
      }
    }
  }

  /**
   * Set a value in the cache
   */
  public async set(key: string, value: any, options: SetOptions = {}): Promise<boolean> {
    try {
      validateKey(key);

      const namespace = options.namespace || this.config.defaultNamespace;
      const cacheKey = generateCacheKey(key, namespace, this.config.keyPrefix);
      const ttl = parseTtl(options.ttl) || this.config.defaultTtl;

      let serializedValue = options.serialize
        ? options.serialize(value)
        : serialize(value);

      // Compress if enabled and value is large enough
      let finalValue: string | Buffer = serializedValue;
      let isCompressed = false;

      if ((options.compress ?? this.config.enableCompression) &&
          shouldCompress(serializedValue)) {
        finalValue = await compress(serializedValue);
        isCompressed = true;
      }

      // Prepare Redis command arguments
      const args: any[] = [cacheKey, finalValue];

      if (ttl > 0) {
        args.push('EX', ttl);
      }

      if (options.nx) {
        args.push('NX');
      } else if (options.xx) {
        args.push('XX');
      }

      const result = await (this.redis.set as any)(...args);
      const success = result === 'OK';

      if (success) {
        this.stats.sets++;

        // Store metadata if compressed or has tags
        if (isCompressed || options.tags) {
          const metadata = {
            compressed: isCompressed,
            tags: options.tags || [],
          };
          await this.redis.hset(`${cacheKey}:meta`, metadata);

          if (ttl > 0) {
            await this.redis.expire(`${cacheKey}:meta`, ttl);
          }
        }

        this.emitEvent('set', key, namespace, { value, options });
      }

      return success;
    } catch (error) {
      this.stats.errors++;
      this.emitEvent('error', key, options.namespace, { error });
      throw error;
    }
  }

  /**
   * Get a value from the cache
   */
  public async get<T = any>(key: string, options: GetOptions = {}): Promise<T | null> {
    try {
      validateKey(key);

      const namespace = options.namespace || this.config.defaultNamespace;
      const cacheKey = generateCacheKey(key, namespace, this.config.keyPrefix);

      const [value, metadata] = await Promise.all([
        this.redis.get(cacheKey),
        this.redis.hgetall(`${cacheKey}:meta`),
      ]);

      if (value === null) {
        this.stats.misses++;
        this.emitEvent('miss', key, namespace);
        return options.defaultValue ?? null;
      }

      this.stats.hits++;

      // Refresh TTL if requested
      if (options.refreshTtl && options.ttl) {
        const ttl = parseTtl(options.ttl);
        if (ttl && ttl > 0) {
          await this.redis.expire(cacheKey, ttl);
          if (metadata && Object.keys(metadata).length > 0) {
            await this.redis.expire(`${cacheKey}:meta`, ttl);
          }
        }
      }

      let finalValue = value;

      // Decompress if needed
      if (metadata['compressed'] === 'true') {
        finalValue = await decompress(Buffer.from(value, 'binary'));
      }

      const deserializedValue = options.deserialize
        ? options.deserialize(finalValue)
        : deserialize(finalValue);

      this.emitEvent('hit', key, namespace, { value: deserializedValue });

      return deserializedValue;
    } catch (error) {
      this.stats.errors++;
      this.emitEvent('error', key, options.namespace, { error });
      throw error;
    }
  }

  /**
   * Delete a value from the cache
   */
  public async del(key: string, options: DelOptions = {}): Promise<number> {
    try {
      validateKey(key);

      const namespace = options.namespace || this.config.defaultNamespace;

      if (options.pattern) {
        return await this.deleteByPattern(options.pattern, namespace);
      }

      const cacheKey = generateCacheKey(key, namespace, this.config.keyPrefix);
      const metaKey = `${cacheKey}:meta`;

      const deleted = await this.redis.del(cacheKey, metaKey);

      if (deleted > 0) {
        this.stats.deletes++;
        this.emitEvent('delete', key, namespace);
      }

      return deleted;
    } catch (error) {
      this.stats.errors++;
      this.emitEvent('error', key, options.namespace, { error });
      throw error;
    }
  }

  /**
   * Delete keys by pattern
   */
  private async deleteByPattern(pattern: string, namespace: string): Promise<number> {
    const scanPattern = generateScanPattern(pattern, namespace, this.config.keyPrefix);
    const keys: string[] = [];

    let cursor = '0';
    do {
      const result = await this.redis.scan(cursor, 'MATCH', scanPattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    if (keys.length === 0) {
      return 0;
    }

    // Also delete metadata keys
    const metaKeys = keys.map(key => `${key}:meta`);
    const allKeys = [...keys, ...metaKeys];

    const deleted = await this.redis.del(...allKeys);
    this.stats.deletes += deleted;

    return deleted;
  }

  /**
   * Clear cache entries
   */
  public async clear(options: ClearOptions = {}): Promise<number> {
    try {
      let pattern = '*';

      if (options.namespace) {
        pattern = generateScanPattern('*', options.namespace, this.config.keyPrefix);
      } else if (options.pattern) {
        pattern = generateScanPattern(options.pattern, this.config.defaultNamespace, this.config.keyPrefix);
      } else {
        pattern = generateScanPattern('*', this.config.defaultNamespace, this.config.keyPrefix);
      }

      if (options.tags && options.tags.length > 0) {
        return await this.clearByTags(options.tags);
      }

      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length === 0) {
        return 0;
      }

      // Also include metadata keys
      const metaKeys = keys.map(key => `${key}:meta`);
      const allKeys = [...keys, ...metaKeys];

      const deleted = await this.redis.del(...allKeys);

      this.emitEvent('clear', undefined, options.namespace, { deleted, pattern });

      return deleted;
    } catch (error) {
      this.stats.errors++;
      this.emitEvent('error', undefined, options.namespace, { error });
      throw error;
    }
  }

  /**
   * Clear cache entries by tags
   */
  private async clearByTags(tags: string[]): Promise<number> {
    const keys: string[] = [];
    let cursor = '0';

    // Find all metadata keys
    const metaPattern = generateScanPattern('*:meta', this.config.defaultNamespace, this.config.keyPrefix);

    do {
      const result = await this.redis.scan(cursor, 'MATCH', metaPattern, 'COUNT', 100);
      cursor = result[0];

      for (const metaKey of result[1]) {
        const metadata = await this.redis.hgetall(metaKey);
        const keyTags = metadata['tags'] ? JSON.parse(metadata['tags']) : [];

        if (tags.some(tag => keyTags.includes(tag))) {
          const originalKey = metaKey.replace(':meta', '');
          keys.push(originalKey, metaKey);
        }
      }
    } while (cursor !== '0');

    if (keys.length === 0) {
      return 0;
    }

    return await this.redis.del(...keys);
  }

  /**
   * Register a warmup task
   */
  public registerWarmupTask(task: WarmupTask): void {
    this.warmupTasks.set(task.id, task);
    this.emitEvent('warmup', task.id, undefined, { task, status: 'registered' });
  }

  /**
   * Unregister a warmup task
   */
  public unregisterWarmupTask(taskId: string): boolean {
    const removed = this.warmupTasks.delete(taskId);

    if (removed) {
      // Remove from queue if present
      this.warmupQueue = this.warmupQueue.filter(task => task.id !== taskId);
      this.emitEvent('warmup', taskId, undefined, { status: 'unregistered' });
    }

    return removed;
  }

  /**
   * Queue a warmup task for execution
   */
  public queueWarmupTask(taskId: string, options: QueueWarmupOptions = {}): boolean {
    const task = this.warmupTasks.get(taskId);

    if (!task) {
      throw new Error(`Warmup task with id '${taskId}' not found`);
    }

    // Check if task is already in queue
    if (this.warmupQueue.some(t => t.id === taskId)) {
      return false;
    }

    // Apply queue options to task
    const queuedTask: WarmupTask = {
      ...task,
      ...(options.priority !== undefined && { priority: options.priority }),
    };

    this.warmupQueue.push(queuedTask);
    this.emitEvent('warmup', taskId, undefined, { task, status: 'queued', options });

    return true;
  }

  /**
   * Run a warmup task immediately
   */
  public async runWarmupTask(taskId: string): Promise<void> {
    const task = this.warmupTasks.get(taskId);

    if (!task) {
      throw new Error(`Warmup task with id '${taskId}' not found`);
    }

    await this.executeWarmupTask(task);
  }

  /**
   * Generate cache key with namespace and prefix
   */
  protected generateCacheKey(key: string, namespace?: string): string {
    return generateCacheKey(
      key,
      namespace || this.config.defaultNamespace,
      this.config.keyPrefix
    );
  }

  /**
   * Serialize value for storage
   */
  protected serializeValue(value: any): string {
    return serialize(value);
  }

  /**
   * Deserialize value from storage
   */
  protected deserializeValue(value: string): any {
    return deserialize(value);
  }

  /**
   * Destroy cache instance and cleanup resources
   */
  public async destroy(): Promise<void> {
    this.stopWarmupProcessor();

    if (this.redis && this.redis.status !== 'end') {
      await this.redis.quit();
    }

    this.removeAllListeners();
  }
}
