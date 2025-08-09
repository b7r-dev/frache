# Express + SQLite + Sequelize Example

This example demonstrates how to use the Frache caching library in a real-world Express.js application with SQLite database and Sequelize ORM. The example shows a Widget management system with complex relationships and comprehensive caching strategies.

## Features Demonstrated

### 1. **Basic Cache Operations**
- `set()` - Cache widget data with TTL
- `get()` - Retrieve cached widgets
- `del()` - Remove specific cache entries
- `clear()` - Bulk cache invalidation

### 2. **Advanced Cache Features**
- `getOrSet()` - Cache-aside pattern implementation
- `setMany()` / `getMany()` - Batch operations
- `increment()` - Track widget view counts
- `listPush()` / `listPop()` - Recently updated widgets queue
- `setAdd()` / `setRemove()` - Popular widgets set management

### 3. **Intelligent Caching Strategies**
- **Multi-level TTL**: Different expiration times for different data types
- **Tag-based invalidation**: Clear related cache entries efficiently
- **Relationship caching**: Cache widgets with their suppliers and features
- **Analytics caching**: Track and cache view counts and popularity

### 4. **Warmup Tasks**
- **Preload popular widgets**: Automatically cache frequently accessed data
- **Cache statistics logging**: Monitor cache performance
- **Priority-based execution**: Control warmup task execution order

## Data Model

```typescript
interface Widget {
  id: number;
  name: string;
  description: string;
  price: number;
  supplierId: number;
  supplier?: Supplier;      // One-to-one relationship
  features?: Feature[];     // One-to-many relationship
  createdAt: Date;
  updatedAt: Date;
}

interface Supplier {
  id: number;
  name: string;
  email: string;
  country: string;
}

interface Feature {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
}
```

## API Endpoints

### Widget Management
- `GET /widgets` - Get all widgets (paginated, cached)
- `GET /widgets/:id` - Get widget with relations (cached with tags)
- `PUT /widgets/:id` - Update widget (invalidates related cache)
- `DELETE /widgets/:id` - Delete widget (cleans up all related cache)
- `GET /widgets/:id/analytics` - Get widget view analytics

### Cache Management
- `POST /cache/warmup` - Trigger cache warmup tasks
- `GET /cache/stats` - Get cache performance statistics

## Caching Strategies Used

### 1. **Cache-Aside Pattern**
```typescript
const widget = await cache.getOrSet(`widget:${id}:full`, async () => {
  // Fetch from database if not in cache
  const widget = await mockDatabase.getWidget(id);
  // ... fetch related data
  return widget;
}, { ttl: 3600, tags: ['widget', `widget:${id}`] });
```

### 2. **Write-Through Cache Invalidation**
```typescript
// After updating widget
await Promise.all([
  cache.del(`widget:${id}:full`),
  cache.clear({ tags: ['widgets', 'pagination'] }),
  cache.del(`widget:${id}:features`),
]);
```

### 3. **Multi-Level TTL Strategy**
- Widgets: 1 hour (3600s) - moderate change frequency
- Suppliers: 2 hours (7200s) - change less frequently
- Features: 30 minutes (1800s) - might change more often
- Pagination: 10 minutes (600s) - needs frequent updates
- Analytics: 24 hours (86400s) - daily aggregation

### 4. **Tag-Based Cache Management**
```typescript
// Cache with tags for easy invalidation
await cache.set(key, value, {
  ttl: 3600,
  tags: ['widget', `widget:${id}`, 'relationships']
});

// Invalidate all related entries
await cache.clear({ tags: ['widget'] });
```

## Running the Example

1. **Install dependencies**:
```bash
npm install express @types/express
```

2. **Start the server**:
```bash
npx ts-node examples/express-controller.ts
```

3. **Test the endpoints**:
```bash
# Get a widget (will cache the result)
curl http://localhost:3000/widgets/1

# Get all widgets with pagination
curl http://localhost:3000/widgets?page=1&limit=5

# Update a widget (will invalidate cache)
curl -X PUT http://localhost:3000/widgets/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Widget"}'

# Get widget analytics
curl http://localhost:3000/widgets/1/analytics

# Trigger cache warmup
curl -X POST http://localhost:3000/cache/warmup

# Get cache statistics
curl http://localhost:3000/cache/stats
```

## Performance Benefits

### Without Cache
- Widget with relations: ~225ms (100ms + 50ms + 75ms)
- All widgets: ~200ms
- Multiple requests: Linear scaling

### With Cache
- Cached widget: ~1-5ms
- Cache hit ratio: 80-95% typical
- Response time improvement: 95%+ for cached data
- Database load reduction: 80-95%

## Cache Events and Monitoring

The example includes comprehensive cache event monitoring:

```typescript
cache.on('hit', (event) => {
  console.log(`Cache hit: ${event.key}`);
});

cache.on('miss', (event) => {
  console.log(`Cache miss: ${event.key}`);
});

cache.on('warmup', (event) => {
  console.log(`Warmup task ${event.data.task.name}: ${event.data.status}`);
});
```

## Best Practices Demonstrated

1. **Namespace organization**: Use consistent key patterns
2. **TTL strategy**: Different expiration times based on data volatility
3. **Tag-based invalidation**: Group related cache entries
4. **Batch operations**: Use `setMany`/`getMany` for efficiency
5. **Error handling**: Graceful degradation when cache fails
6. **Monitoring**: Track cache performance and hit rates
7. **Warmup tasks**: Proactively cache important data
8. **Memory management**: Use appropriate TTLs to prevent memory bloat

This example showcases how Frache can significantly improve application performance while maintaining data consistency and providing powerful cache management capabilities.
