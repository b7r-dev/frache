# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-01-XX

### Added

#### Core Features
- **Cache Class**: Singleton cache implementation with ioredis integration
- **Basic Operations**: `set()`, `get()`, `del()`, `clear()` methods with comprehensive options
- **Advanced Cache**: Extended functionality with data structures and batch operations
- **TypeScript Support**: Full TypeScript definitions and strict type safety

#### Intelligent Caching
- **Cache-aside Pattern**: `getOrSet()` method for seamless cache-aside implementation
- **Compression**: Automatic compression for large values using gzip
- **Serialization**: Smart JSON serialization with fallback handling
- **Tag-based Invalidation**: Group and invalidate related cache entries
- **Namespace Support**: Organize cache keys with configurable namespaces

#### Advanced Features
- **Warmup Tasks**: Proactive cache warming with priority queues and scheduling
- **Data Structures**: Redis lists, sets, and counters with native operations
- **Batch Operations**: `setMany()`, `getMany()`, `delMany()` for improved performance
- **TTL Management**: Flexible TTL configuration with per-key and global defaults
- **Memory Management**: Configurable memory limits and intelligent cleanup

#### Monitoring & Observability
- **Event System**: Comprehensive event emission for cache operations
- **Performance Metrics**: Built-in statistics tracking (hits, misses, errors)
- **Health Monitoring**: Cache health checks and status reporting
- **Debug Support**: Detailed logging and error handling

#### Developer Experience
- **Express Integration**: Complete Express.js example with SQLite and Sequelize
- **Comprehensive Examples**: Basic usage, advanced patterns, and real-world scenarios
- **Documentation**: Detailed README, API docs, and contributing guidelines
- **Testing**: 96+ unit tests with high coverage

### Technical Details

#### Architecture
- Singleton pattern for thread-safe cache instances
- Event-driven architecture for monitoring and extensibility
- Modular design with separate core and advanced functionality
- Clean separation of concerns with utility modules

#### Performance Optimizations
- Efficient key generation and validation
- Smart compression thresholds
- Batch operation support to reduce Redis round trips
- Memory-efficient serialization

#### Configuration Options
- Custom Redis client support
- Configurable TTL defaults and namespaces
- Compression and memory management settings
- Warmup task scheduling and execution

### Dependencies
- **ioredis**: ^5.3.2 (Redis client)
- **Node.js**: >=14.0.0

### Development Dependencies
- TypeScript 5.2.2 with strict mode
- Jest for testing with 96+ test cases
- ESLint and Prettier for code quality
- GitHub Actions for CI/CD

## [0.1.0] - Development

### Added
- Initial project setup
- Basic cache functionality
- TypeScript configuration
- Testing framework setup

---

## Release Notes

### v1.0.0 - Initial Release

This is the first stable release of Frache, providing a comprehensive caching solution for Node.js applications.

**Key Highlights:**
- 🚀 Production-ready caching with Redis backend
- 🧠 Intelligent features like compression and warmup tasks
- 📊 Built-in monitoring and performance metrics
- 🎯 TypeScript-first with complete type safety
- 📚 Comprehensive documentation and examples

**Getting Started:**
```bash
npm install frache ioredis
```

**Quick Example:**
```typescript
import { Cache } from 'frache';

const cache = Cache.getInstance();
await cache.set('key', 'value', { ttl: 3600 });
const value = await cache.get('key');
```

For detailed usage instructions, see the [README](README.md) and [examples](examples/).

### Migration Guide

This is the initial release, so no migration is needed.

### Breaking Changes

None - this is the initial release.

### Deprecations

None - this is the initial release.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
