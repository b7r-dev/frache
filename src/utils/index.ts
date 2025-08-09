import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Generate a cache key with namespace and optional hashing
 */
export function generateCacheKey(key: string, namespace?: string, keyPrefix?: string): string {
  const parts: string[] = [];

  if (keyPrefix) {
    parts.push(keyPrefix);
  }

  if (namespace) {
    parts.push(namespace);
  }

  parts.push(key);

  return parts.join(':');
}

/**
 * Hash a string using SHA-256
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Serialize a value to string
 */
export function serialize(value: any): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new Error(`Failed to serialize value: ${(error as Error).message}`);
  }
}

/**
 * Deserialize a string to value
 */
export function deserialize(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    // If JSON parsing fails, return the string as-is
    return value;
  }
}

/**
 * Compress a string using gzip
 */
export async function compress(data: string): Promise<Buffer> {
  try {
    return await gzipAsync(Buffer.from(data, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to compress data: ${(error as Error).message}`);
  }
}

/**
 * Decompress gzipped data
 */
export async function decompress(data: Buffer): Promise<string> {
  try {
    const decompressed = await gunzipAsync(data);
    return decompressed.toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decompress data: ${(error as Error).message}`);
  }
}

/**
 * Check if a value should be compressed
 */
export function shouldCompress(data: string, threshold = 1024): boolean {
  return Buffer.byteLength(data, 'utf8') > threshold;
}

/**
 * Generate a pattern for Redis SCAN command
 */
export function generateScanPattern(
  pattern: string,
  namespace?: string,
  keyPrefix?: string
): string {
  const parts: string[] = [];

  if (keyPrefix) {
    parts.push(keyPrefix);
  }

  if (namespace) {
    parts.push(namespace);
  }

  parts.push(pattern);

  return parts.join(':');
}

/**
 * Parse TTL value and convert to seconds
 */
export function parseTtl(ttl?: number | string): number | undefined {
  if (ttl === undefined || ttl === null) {
    return undefined;
  }

  if (typeof ttl === 'number') {
    return ttl;
  }

  if (typeof ttl === 'string') {
    const parsed = parseInt(ttl, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid TTL value: ${ttl}`);
    }
    return parsed;
  }

  throw new Error(`Invalid TTL type: ${typeof ttl}`);
}

/**
 * Validate cache key
 */
export function validateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Cache key must be a non-empty string');
  }

  if (key.length > 250) {
    throw new Error('Cache key is too long (max 250 characters)');
  }

  // Check for invalid characters
  if (/[\r\n\t\0]/.test(key)) {
    throw new Error('Cache key contains invalid characters');
  }
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i === attempts - 1) {
        break;
      }

      const delayMs = baseDelay * Math.pow(2, i);
      await delay(delayMs);
    }
  }

  throw lastError!;
}
