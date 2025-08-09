import { Redis } from 'ioredis';

/**
 * Cache operation options
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Namespace for the cache key */
  namespace?: string;
  /** Whether to compress the value */
  compress?: boolean;
  /** Custom serialization function */
  serialize?: (value: any) => string;
  /** Custom deserialization function */
  deserialize?: (value: string) => any;
  /** Tags for cache invalidation */
  tags?: string[];
}

/**
 * Cache set operation options
 */
export interface SetOptions extends CacheOptions {
  /** Whether to set only if key doesn't exist */
  nx?: boolean;
  /** Whether to set only if key exists */
  xx?: boolean;
}

/**
 * Cache get operation options
 */
export interface GetOptions extends CacheOptions {
  /** Default value if key doesn't exist */
  defaultValue?: any;
  /** Whether to refresh TTL on get */
  refreshTtl?: boolean;
}

/**
 * Cache delete operation options
 */
export interface DelOptions extends CacheOptions {
  /** Pattern matching for bulk delete */
  pattern?: string;
}

/**
 * Cache clear operation options
 */
export interface ClearOptions {
  /** Namespace to clear */
  namespace?: string;
  /** Tags to clear */
  tags?: string[];
  /** Pattern matching for bulk clear */
  pattern?: string;
}

/**
 * Warmup task definition
 */
export interface WarmupTask {
  /** Unique identifier for the task */
  id: string;
  /** Human-readable name */
  name: string;
  /** Task description */
  description?: string;
  /** Function to execute for warming up cache */
  execute: () => Promise<void> | void;
  /** Schedule for automatic execution (cron-like) */
  schedule?: string;
  /** Priority for execution order */
  priority?: number;
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Whether task should retry on failure */
  retry?: boolean;
  /** Number of retry attempts */
  retryAttempts?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Warmup task queue options
 */
export interface QueueWarmupOptions {
  /** Delay before execution in milliseconds */
  delay?: number;
  /** Priority in queue */
  priority?: number;
  /** Maximum number of attempts */
  attempts?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Redis client instance */
  redis?: Redis;
  /** Redis connection options */
  redisOptions?: any;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Default namespace */
  defaultNamespace?: string;
  /** Whether to enable compression by default */
  enableCompression?: boolean;
  /** Maximum memory usage before cleanup */
  maxMemory?: number;
  /** Cache key prefix */
  keyPrefix?: string;
  /** Whether to enable warmup tasks */
  enableWarmup?: boolean;
  /** Warmup task execution interval in milliseconds */
  warmupInterval?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  memoryUsage?: number;
  keyCount?: number;
}

/**
 * Cache event types
 */
export type CacheEventType = 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'error' | 'warmup';

/**
 * Cache event data
 */
export interface CacheEvent {
  type: CacheEventType;
  key?: string;
  namespace?: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

/**
 * Cache event listener
 */
export type CacheEventListener = (event: CacheEvent) => void;
