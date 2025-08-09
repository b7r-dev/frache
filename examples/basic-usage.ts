/**
 * Basic Usage Examples for Frache
 * 
 * This file demonstrates the fundamental caching operations
 * and patterns using the Frache library.
 */

import { Cache } from '../src';

async function basicUsageExamples() {
  // Initialize cache with default configuration
  const cache = Cache.getInstance({
    defaultTtl: 3600, // 1 hour
    defaultNamespace: 'examples',
  });

  console.log('🚀 Basic Frache Usage Examples\n');

  // ===== BASIC OPERATIONS =====
  console.log('📝 Basic Operations');
  
  // Set a simple string value
  await cache.set('greeting', 'Hello, World!');
  console.log('✓ Set greeting');

  // Get the value back
  const greeting = await cache.get('greeting');
  console.log(`✓ Got greeting: ${greeting}`);

  // Set with custom TTL (5 minutes)
  await cache.set('temp-data', 'This expires soon', { ttl: 300 });
  console.log('✓ Set temporary data with 5-minute TTL');

  // Set complex objects
  const user = {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true,
    },
  };

  await cache.set('user:123', user, { ttl: 1800 }); // 30 minutes
  console.log('✓ Set user object');

  // Get complex objects
  const cachedUser = await cache.get('user:123');
  console.log(`✓ Got user: ${cachedUser?.name} (${cachedUser?.email})`);

  // ===== NAMESPACES =====
  console.log('\n🏷️  Namespace Examples');

  // Use different namespaces to organize data
  await cache.set('config', { theme: 'light' }, { namespace: 'app' });
  await cache.set('config', { name: 'John' }, { namespace: 'user' });

  const appConfig = await cache.get('config', { namespace: 'app' });
  const userConfig = await cache.get('config', { namespace: 'user' });

  console.log(`✓ App config: ${JSON.stringify(appConfig)}`);
  console.log(`✓ User config: ${JSON.stringify(userConfig)}`);

  // ===== CACHE-ASIDE PATTERN =====
  console.log('\n🎯 Cache-Aside Pattern');

  // Simulate a database call
  const fetchUserFromDatabase = async (id: number) => {
    console.log(`  📊 Fetching user ${id} from database...`);
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
      createdAt: new Date(),
    };
  };

  // First call - cache miss, will fetch from database
  console.log('First call (cache miss):');
  const user1 = await cache.getOrSet('user:456', () => fetchUserFromDatabase(456), {
    ttl: 600, // 10 minutes
  });
  console.log(`✓ Got user: ${user1.name}`);

  // Second call - cache hit, no database call
  console.log('Second call (cache hit):');
  const user2 = await cache.getOrSet('user:456', () => fetchUserFromDatabase(456), {
    ttl: 600,
  });
  console.log(`✓ Got user: ${user2.name}`);

  // ===== CONDITIONAL OPERATIONS =====
  console.log('\n🔄 Conditional Operations');

  // Set only if key doesn't exist (NX)
  const setResult1 = await cache.set('counter', 1, { nx: true });
  console.log(`✓ Set counter (NX): ${setResult1}`);

  // Try to set again - should fail because key exists
  const setResult2 = await cache.set('counter', 2, { nx: true });
  console.log(`✓ Set counter again (NX): ${setResult2}`);

  // Set only if key exists (XX)
  const setResult3 = await cache.set('counter', 5, { xx: true });
  console.log(`✓ Update counter (XX): ${setResult3}`);

  // ===== DEFAULT VALUES =====
  console.log('\n🎯 Default Values');

  // Get with default value
  const nonExistentValue = await cache.get('does-not-exist', {
    defaultValue: 'default response',
  });
  console.log(`✓ Got with default: ${nonExistentValue}`);

  // ===== DELETION =====
  console.log('\n🗑️  Deletion Examples');

  // Delete single key
  const deleted = await cache.del('temp-data');
  console.log(`✓ Deleted temp-data: ${deleted} keys removed`);

  // Delete by pattern
  await cache.set('session:abc123', 'session data 1');
  await cache.set('session:def456', 'session data 2');
  await cache.set('session:ghi789', 'session data 3');

  const deletedSessions = await cache.del('pattern', { pattern: 'session:*' });
  console.log(`✓ Deleted sessions by pattern: ${deletedSessions} keys removed`);

  // ===== CLEARING CACHE =====
  console.log('\n🧹 Cache Clearing');

  // Clear entire namespace
  const clearedCount = await cache.clear({ namespace: 'examples' });
  console.log(`✓ Cleared examples namespace: ${clearedCount} keys removed`);

  // ===== STATISTICS =====
  console.log('\n📊 Cache Statistics');

  const stats = cache.getStats();
  console.log('Cache Statistics:');
  console.log(`  Hits: ${stats.hits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Sets: ${stats.sets}`);
  console.log(`  Deletes: ${stats.deletes}`);
  console.log(`  Errors: ${stats.errors}`);

  if (stats.hits + stats.misses > 0) {
    const hitRate = (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2);
    console.log(`  Hit Rate: ${hitRate}%`);
  }

  // ===== EVENT MONITORING =====
  console.log('\n📡 Event Monitoring');

  // Set up event listeners
  cache.on('hit', (event) => {
    console.log(`  🎯 Cache hit: ${event.key}`);
  });

  cache.on('miss', (event) => {
    console.log(`  ❌ Cache miss: ${event.key}`);
  });

  cache.on('set', (event) => {
    console.log(`  💾 Cache set: ${event.key}`);
  });

  // Trigger some events
  await cache.set('monitored-key', 'monitored value');
  await cache.get('monitored-key'); // Should trigger hit
  await cache.get('non-existent-key'); // Should trigger miss

  console.log('\n✅ Basic usage examples completed!');

  // Clean up
  await cache.destroy();
}

// Run the examples
if (require.main === module) {
  basicUsageExamples().catch(console.error);
}

export { basicUsageExamples };
