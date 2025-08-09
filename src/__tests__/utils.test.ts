import {
  generateCacheKey,
  hashKey,
  serialize,
  deserialize,
  compress,
  decompress,
  shouldCompress,
  generateScanPattern,
  parseTtl,
  validateKey,
  delay,
  retry,
} from '../utils';

describe('Utils', () => {
  describe('generateCacheKey', () => {
    it('should generate cache key with all parts', () => {
      const key = generateCacheKey('user:123', 'session', 'myapp');
      expect(key).toBe('myapp:session:user:123');
    });

    it('should generate cache key without prefix', () => {
      const key = generateCacheKey('user:123', 'session');
      expect(key).toBe('session:user:123');
    });

    it('should generate cache key without namespace', () => {
      const key = generateCacheKey('user:123', undefined, 'myapp');
      expect(key).toBe('myapp:user:123');
    });

    it('should generate simple cache key', () => {
      const key = generateCacheKey('user:123');
      expect(key).toBe('user:123');
    });
  });

  describe('hashKey', () => {
    it('should generate consistent hash', () => {
      const hash1 = hashKey('test-key');
      const hash2 = hashKey('test-key');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 character hex string
    });

    it('should generate different hashes for different keys', () => {
      const hash1 = hashKey('key1');
      const hash2 = hashKey('key2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('serialize', () => {
    it('should return strings as-is', () => {
      const result = serialize('test string');
      expect(result).toBe('test string');
    });

    it('should JSON stringify objects', () => {
      const obj = { name: 'John', age: 30 };
      const result = serialize(obj);
      expect(result).toBe(JSON.stringify(obj));
    });

    it('should JSON stringify arrays', () => {
      const arr = [1, 2, 3];
      const result = serialize(arr);
      expect(result).toBe(JSON.stringify(arr));
    });

    it('should JSON stringify numbers', () => {
      const result = serialize(42);
      expect(result).toBe('42');
    });

    it('should handle null and undefined', () => {
      expect(serialize(null)).toBe('null');
      expect(serialize(undefined)).toBe(undefined); // JSON.stringify returns undefined
    });
  });

  describe('deserialize', () => {
    it('should parse valid JSON', () => {
      const obj = { name: 'John', age: 30 };
      const serialized = JSON.stringify(obj);
      const result = deserialize(serialized);
      expect(result).toEqual(obj);
    });

    it('should return string as-is for invalid JSON', () => {
      const result = deserialize('not json');
      expect(result).toBe('not json');
    });

    it('should handle empty string', () => {
      const result = deserialize('');
      expect(result).toBe('');
    });
  });

  describe('compress and decompress', () => {
    it('should compress and decompress data', async () => {
      const originalData = 'This is a test string that should be compressed';
      const compressed = await compress(originalData);
      const decompressed = await decompress(compressed);

      expect(decompressed).toBe(originalData);
      expect(compressed).toBeInstanceOf(Buffer);
    });

    it('should handle large data', async () => {
      const largeData = 'x'.repeat(10000);
      const compressed = await compress(largeData);
      const decompressed = await decompress(compressed);

      expect(decompressed).toBe(largeData);
      expect(compressed.length).toBeLessThan(largeData.length);
    });

    it('should handle empty string', async () => {
      const compressed = await compress('');
      const decompressed = await decompress(compressed);
      expect(decompressed).toBe('');
    });
  });

  describe('shouldCompress', () => {
    it('should return false for small data', () => {
      const smallData = 'small';
      expect(shouldCompress(smallData)).toBe(false);
    });

    it('should return true for large data', () => {
      const largeData = 'x'.repeat(2000);
      expect(shouldCompress(largeData)).toBe(true);
    });

    it('should respect custom threshold', () => {
      const data = 'x'.repeat(500);
      expect(shouldCompress(data, 1000)).toBe(false);
      expect(shouldCompress(data, 100)).toBe(true);
    });
  });

  describe('generateScanPattern', () => {
    it('should generate scan pattern with all parts', () => {
      const pattern = generateScanPattern('user:*', 'session', 'myapp');
      expect(pattern).toBe('myapp:session:user:*');
    });

    it('should generate scan pattern without prefix', () => {
      const pattern = generateScanPattern('user:*', 'session');
      expect(pattern).toBe('session:user:*');
    });
  });

  describe('parseTtl', () => {
    it('should return number as-is', () => {
      expect(parseTtl(3600)).toBe(3600);
    });

    it('should parse string numbers', () => {
      expect(parseTtl('3600')).toBe(3600);
    });

    it('should return undefined for undefined', () => {
      expect(parseTtl(undefined)).toBeUndefined();
    });

    it('should return undefined for null', () => {
      expect(parseTtl(null as any)).toBeUndefined();
    });

    it('should throw for invalid string', () => {
      expect(() => parseTtl('invalid')).toThrow('Invalid TTL value');
    });

    it('should throw for invalid type', () => {
      expect(() => parseTtl({} as any)).toThrow('Invalid TTL type');
    });
  });

  describe('validateKey', () => {
    it('should accept valid keys', () => {
      expect(() => validateKey('valid-key')).not.toThrow();
      expect(() => validateKey('user:123')).not.toThrow();
      expect(() => validateKey('a'.repeat(250))).not.toThrow();
    });

    it('should reject empty keys', () => {
      expect(() => validateKey('')).toThrow('Cache key must be a non-empty string');
      expect(() => validateKey(null as any)).toThrow('Cache key must be a non-empty string');
      expect(() => validateKey(undefined as any)).toThrow('Cache key must be a non-empty string');
    });

    it('should reject long keys', () => {
      const longKey = 'a'.repeat(251);
      expect(() => validateKey(longKey)).toThrow('Cache key is too long');
    });

    it('should reject keys with invalid characters', () => {
      expect(() => validateKey('key\nwith\nnewlines')).toThrow('Cache key contains invalid characters');
      expect(() => validateKey('key\twith\ttabs')).toThrow('Cache key contains invalid characters');
      expect(() => validateKey('key\rwith\rcarriage')).toThrow('Cache key contains invalid characters');
      expect(() => validateKey('key\0with\0null')).toThrow('Cache key contains invalid characters');
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3, 10); // 3 attempts, 10ms delay

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const error = new Error('persistent failure');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(retry(fn, 2, 10)).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retry(fn, 3, 50); // 50ms base delay
      const elapsed = Date.now() - start;

      // Should have delays of ~50ms and ~100ms, so total should be > 150ms
      expect(elapsed).toBeGreaterThan(140);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
