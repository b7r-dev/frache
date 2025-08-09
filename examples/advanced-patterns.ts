/**
 * Advanced Caching Patterns with Frache
 * 
 * This file demonstrates sophisticated caching strategies,
 * data structures, and patterns for production applications.
 */

import { AdvancedCache } from '../src';

async function advancedPatternsExamples() {
  // Initialize advanced cache
  const cache = AdvancedCache.getInstance({
    defaultTtl: 3600,
    defaultNamespace: 'advanced',
    enableCompression: true,
    enableWarmup: true,
  });

  console.log('🚀 Advanced Frache Patterns\n');

  // ===== BATCH OPERATIONS =====
  console.log('📦 Batch Operations');

  // Set multiple values at once
  const users = [
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob', role: 'user' },
    { id: 3, name: 'Charlie', role: 'moderator' },
  ];

  const setResults = await cache.setMany(
    users.map(user => ({
      key: `user:${user.id}`,
      value: user,
      options: { ttl: 1800, tags: ['users', `user:${user.id}`] },
    }))
  );
  console.log(`✓ Batch set ${setResults.filter(Boolean).length} users`);

  // Get multiple values at once
  const userKeys = users.map(u => `user:${u.id}`);
  const cachedUsers = await cache.getMany(userKeys);
  console.log(`✓ Batch get ${cachedUsers.filter(u => u.value).length} users`);

  // ===== TAG-BASED INVALIDATION =====
  console.log('\n🏷️  Tag-Based Cache Invalidation');

  // Cache products with tags
  const products = [
    { id: 1, name: 'Laptop', category: 'electronics', price: 999 },
    { id: 2, name: 'Phone', category: 'electronics', price: 599 },
    { id: 3, name: 'Book', category: 'books', price: 29 },
  ];

  for (const product of products) {
    await cache.set(`product:${product.id}`, product, {
      ttl: 7200,
      tags: ['products', `category:${product.category}`, `product:${product.id}`],
    });
  }
  console.log('✓ Cached products with category tags');

  // Invalidate all electronics
  const electronicsCleared = await cache.clear({ tags: ['category:electronics'] });
  console.log(`✓ Cleared electronics category: ${electronicsCleared} items`);

  // ===== DATA STRUCTURES =====
  console.log('\n🏗️  Redis Data Structures');

  // Lists - for queues, recent items, etc.
  console.log('Lists:');
  await cache.listPush('recent-views', 'product:1');
  await cache.listPush('recent-views', 'product:2');
  await cache.listPush('recent-views', 'product:3');
  
  const recentView = await cache.listPop('recent-views');
  console.log(`  ✓ Most recent view: ${recentView}`);
  
  const queueLength = await cache.listLength('recent-views');
  console.log(`  ✓ Queue length: ${queueLength}`);

  // Sets - for unique collections
  console.log('Sets:');
  await cache.setAdd('active-users', 'user:1');
  await cache.setAdd('active-users', 'user:2');
  await cache.setAdd('active-users', 'user:1'); // Duplicate - won't be added
  
  const isActive = await cache.setContains('active-users', 'user:1');
  console.log(`  ✓ User 1 is active: ${isActive}`);
  
  const activeUsers = await cache.setMembers('active-users');
  console.log(`  ✓ Active users: ${activeUsers.join(', ')}`);
  
  const activeCount = await cache.setSize('active-users');
  console.log(`  ✓ Active user count: ${activeCount}`);

  // Counters - for analytics, rate limiting
  console.log('Counters:');
  await cache.increment('page-views', 1);
  await cache.increment('page-views', 5);
  await cache.increment('api-calls:user:1', 1);
  
  const pageViews = await cache.get('page-views');
  const apiCalls = await cache.get('api-calls:user:1');
  console.log(`  ✓ Page views: ${pageViews}`);
  console.log(`  ✓ API calls for user 1: ${apiCalls}`);

  // ===== WARMUP TASKS =====
  console.log('\n🔥 Cache Warmup Tasks');

  // Register a warmup task for popular content
  cache.registerWarmupTask({
    id: 'popular-products',
    name: 'Cache Popular Products',
    description: 'Pre-cache the most popular products',
    priority: 1,
    execute: async () => {
      console.log('  🔄 Warming up popular products...');
      
      // Simulate fetching popular products
      const popularProducts = [
        { id: 101, name: 'Bestseller 1', views: 1000 },
        { id: 102, name: 'Bestseller 2', views: 850 },
        { id: 103, name: 'Bestseller 3', views: 720 },
      ];
      
      for (const product of popularProducts) {
        await cache.set(`product:${product.id}`, product, {
          ttl: 7200,
          tags: ['products', 'popular'],
        });
      }
      
      console.log(`  ✓ Warmed up ${popularProducts.length} popular products`);
    },
  });

  // Register analytics warmup task
  cache.registerWarmupTask({
    id: 'daily-stats',
    name: 'Daily Statistics',
    description: 'Cache daily statistics',
    priority: 2,
    execute: async () => {
      console.log('  📊 Calculating daily stats...');
      
      const stats = {
        totalUsers: 1250,
        activeUsers: 340,
        totalOrders: 89,
        revenue: 12450.50,
        date: new Date().toISOString().split('T')[0],
      };
      
      await cache.set('daily-stats', stats, { ttl: 86400 }); // 24 hours
      console.log('  ✓ Cached daily statistics');
    },
  });

  // Queue warmup tasks
  cache.queueWarmupTask('popular-products');
  cache.queueWarmupTask('daily-stats');
  console.log('✓ Queued warmup tasks');

  // Run a task immediately
  await cache.runWarmupTask('popular-products');

  // ===== MULTI-LEVEL CACHING =====
  console.log('\n🎯 Multi-Level Caching Strategy');

  // Simulate a complex data fetching scenario
  const fetchUserProfile = async (userId: number) => {
    console.log(`  📊 Fetching user ${userId} profile from database...`);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      profile: {
        bio: 'Software developer',
        location: 'San Francisco',
        joinDate: '2023-01-15',
      },
    };
  };

  const fetchUserPosts = async (userId: number) => {
    console.log(`  📊 Fetching user ${userId} posts from database...`);
    await new Promise(resolve => setTimeout(resolve, 75));
    
    return [
      { id: 1, title: 'Hello World', content: 'My first post' },
      { id: 2, title: 'Learning Caching', content: 'Caching is awesome!' },
    ];
  };

  // Multi-level caching with different TTLs
  const getUserWithPosts = async (userId: number) => {
    const cacheKey = `user-with-posts:${userId}`;
    
    return cache.getOrSet(cacheKey, async () => {
      // Fetch user profile with longer TTL (changes less frequently)
      const profile = await cache.getOrSet(`user-profile:${userId}`, 
        () => fetchUserProfile(userId), 
        { ttl: 7200 } // 2 hours
      );
      
      // Fetch user posts with shorter TTL (changes more frequently)
      const posts = await cache.getOrSet(`user-posts:${userId}`, 
        () => fetchUserPosts(userId), 
        { ttl: 1800 } // 30 minutes
      );
      
      return { ...profile, posts };
    }, { ttl: 3600 }); // 1 hour for combined data
  };

  console.log('First call (cache miss):');
  const userWithPosts1 = await getUserWithPosts(123);
  console.log(`✓ Got user: ${userWithPosts1.name} with ${userWithPosts1.posts.length} posts`);

  console.log('Second call (cache hit):');
  const userWithPosts2 = await getUserWithPosts(123);
  console.log(`✓ Got user: ${userWithPosts2.name} with ${userWithPosts2.posts.length} posts`);

  // ===== RATE LIMITING PATTERN =====
  console.log('\n⏱️  Rate Limiting Pattern');

  const checkRateLimit = async (userId: number, limit = 10, window = 60) => {
    const key = `rate-limit:${userId}`;
    const current = await cache.increment(key, 1, { ttl: window });
    
    if (current === 1) {
      // First request in window, set TTL
      await cache.expire(key, window);
    }
    
    return {
      allowed: current <= limit,
      current,
      limit,
      resetTime: Date.now() + (window * 1000),
    };
  };

  // Test rate limiting
  for (let i = 1; i <= 12; i++) {
    const result = await checkRateLimit(456, 10, 60);
    console.log(`  Request ${i}: ${result.allowed ? '✅ Allowed' : '❌ Rate limited'} (${result.current}/${result.limit})`);
  }

  // ===== CACHE WARMING STRATEGIES =====
  console.log('\n🌡️  Cache Warming Strategies');

  // Predictive warming based on patterns
  const warmPopularContent = async () => {
    console.log('  🔮 Predictive cache warming...');
    
    // Simulate warming content based on historical data
    const popularItems = ['product:1', 'product:2', 'user:123'];
    
    for (const item of popularItems) {
      const [type, id] = item.split(':');
      
      if (type === 'product') {
        await cache.set(item, { id, name: `Product ${id}`, popular: true }, { ttl: 3600 });
      } else if (type === 'user') {
        await cache.set(item, { id, name: `User ${id}`, active: true }, { ttl: 1800 });
      }
    }
    
    console.log(`  ✓ Warmed ${popularItems.length} popular items`);
  };

  await warmPopularContent();

  // ===== PERFORMANCE MONITORING =====
  console.log('\n📈 Performance Monitoring');

  // Set up comprehensive event monitoring
  let hitCount = 0;
  let missCount = 0;

  cache.on('hit', () => hitCount++);
  cache.on('miss', () => missCount++);

  // Perform some operations to generate events
  await cache.get('user:1'); // Should be hit
  await cache.get('non-existent'); // Should be miss
  await cache.get('user:2'); // Should be hit

  const finalStats = cache.getStats();
  console.log('Final Performance Stats:');
  console.log(`  Total Hits: ${finalStats.hits}`);
  console.log(`  Total Misses: ${finalStats.misses}`);
  console.log(`  Total Sets: ${finalStats.sets}`);
  console.log(`  Total Deletes: ${finalStats.deletes}`);
  console.log(`  Errors: ${finalStats.errors}`);

  if (finalStats.hits + finalStats.misses > 0) {
    const hitRate = (finalStats.hits / (finalStats.hits + finalStats.misses) * 100).toFixed(2);
    console.log(`  Hit Rate: ${hitRate}%`);
  }

  console.log('\n✅ Advanced patterns examples completed!');

  // Clean up
  await cache.destroy();
}

// Run the examples
if (require.main === module) {
  advancedPatternsExamples().catch(console.error);
}

export { advancedPatternsExamples };
