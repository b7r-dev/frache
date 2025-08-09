# Contributing to Frache

Thank you for your interest in contributing to Frache! We welcome contributions from the community and are excited to see what you'll bring to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn
- Redis server (for testing)
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/b7r-dev/frache.git
   cd frache
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests to ensure everything works**
   ```bash
   npm test
   ```

4. **Start development**
   ```bash
   npm run build:watch  # Watch mode for TypeScript compilation
   npm run test:watch   # Watch mode for tests
   ```

## 📋 Development Guidelines

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix linting issues
npm run format      # Format code with Prettier
```

### TypeScript

- All code must be written in TypeScript
- Maintain strict type safety
- Export types for public APIs
- Use meaningful type names and interfaces

### Testing

- Write tests for all new features
- Maintain or improve test coverage
- Use descriptive test names
- Mock external dependencies (Redis, etc.)

```bash
npm test              # Run all tests
npm run test:coverage # Run tests with coverage report
```

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add new cache compression feature
fix: resolve memory leak in warmup tasks
docs: update API documentation
test: add tests for batch operations
refactor: improve error handling
```

## 🛠️ Types of Contributions

### 🐛 Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, Redis version, etc.)
- Minimal code example if possible

### ✨ Feature Requests

For new features:

- Describe the use case and problem it solves
- Provide examples of how it would be used
- Consider backward compatibility
- Discuss performance implications

### 📚 Documentation

- Fix typos and improve clarity
- Add examples and use cases
- Update API documentation
- Improve README and guides

### 🧪 Tests

- Add missing test coverage
- Improve test quality and reliability
- Add integration tests
- Performance benchmarks

## 🏗️ Architecture Overview

### Core Components

- **Cache**: Main caching class with singleton pattern
- **AdvancedCache**: Extended functionality with data structures
- **Utils**: Helper functions for serialization, compression, etc.
- **Types**: TypeScript type definitions

### Key Principles

- **Performance**: Optimize for speed and memory efficiency
- **Reliability**: Handle errors gracefully, provide fallbacks
- **Flexibility**: Support various use cases and configurations
- **Type Safety**: Comprehensive TypeScript support

## 📝 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **PR Requirements**
   - Clear title and description
   - Link to related issues
   - All tests passing
   - No linting errors
   - Documentation updated if needed

## 🔍 Code Review Process

- All PRs require review from maintainers
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Be open to suggestions and improvements

## 📊 Performance Considerations

When contributing:

- Consider memory usage implications
- Avoid blocking operations
- Use efficient algorithms and data structures
- Add benchmarks for performance-critical changes

## 🧪 Testing Guidelines

### Unit Tests

- Test individual functions and methods
- Mock external dependencies
- Cover edge cases and error conditions
- Use descriptive test names

### Integration Tests

- Test component interactions
- Use real Redis instance when needed
- Test configuration scenarios
- Verify event emission

### Example Test Structure

```typescript
describe('Cache', () => {
  describe('set method', () => {
    it('should set a simple string value', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';

      // Act
      const result = await cache.set(key, value);

      // Assert
      expect(result).toBe(true);
    });
  });
});
```

## 📚 Documentation Standards

- Use clear, concise language
- Provide code examples
- Include parameter descriptions
- Document return values and exceptions
- Keep examples up to date

## 🚨 Security

- Report security issues privately to maintainers
- Don't include sensitive data in examples
- Follow secure coding practices
- Validate inputs appropriately

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord**: Real-time chat with the community

## 🎉 Recognition

Contributors will be:

- Listed in the CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Invited to join the maintainer team for exceptional contributions

## 📄 License

By contributing to Frache, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Frache! Your efforts help make caching better for the entire Node.js community. 🚀
