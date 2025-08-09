import express, { Request, Response } from 'express';
import { AdvancedCache, renderFracheDashboard } from '../src';

// Simple data types
interface Widget {
  id: number;
  name: string;
  description: string;
  price: number;
  supplierId: number;
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

interface WidgetWithRelations extends Widget {
  supplier?: Supplier | undefined;
  features?: Feature[] | undefined;
}

// Mock database (in-memory)
const mockDatabase = {
  widgets: new Map<number, Widget>([
    [1, {
      id: 1,
      name: 'Super Widget',
      description: 'An amazing widget with advanced features',
      price: 99.99,
      supplierId: 1,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-06-01'),
    }],
    [2, {
      id: 2,
      name: 'Basic Widget',
      description: 'A simple, reliable widget',
      price: 29.99,
      supplierId: 1,
      createdAt: new Date('2023-02-01'),
      updatedAt: new Date('2023-05-01'),
    }],
    [3, {
      id: 3,
      name: 'Premium Widget',
      description: 'Top-of-the-line widget with all features',
      price: 199.99,
      supplierId: 2,
      createdAt: new Date('2023-03-01'),
      updatedAt: new Date('2023-04-01'),
    }],
  ]),

  suppliers: new Map<number, Supplier>([
    [1, { id: 1, name: 'Widget Corp', email: 'contact@widgetcorp.com', country: 'USA' }],
    [2, { id: 2, name: 'Global Widgets Ltd', email: 'info@globalwidgets.com', country: 'UK' }],
  ]),

  features: new Map<number, Feature>([
    [1, { id: 1, name: 'Durability', description: 'Long-lasting construction', enabled: true }],
    [2, { id: 2, name: 'Efficiency', description: 'Energy efficient operation', enabled: true }],
    [3, { id: 3, name: 'Smart Mode', description: 'AI-powered intelligent features', enabled: false }],
  ]),

  widgetFeatures: new Map<number, number[]>([
    [1, [1, 2]], // Super Widget has Durability and Efficiency
    [2, [1]],    // Basic Widget has Durability
    [3, [1, 2, 3]], // Premium Widget has all features
  ]),

  nextId: 4,

  // Simulate database delay
  async delay(ms: number = 100): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  async getWidget(id: number): Promise<Widget | null> {
    await this.delay();
    return this.widgets.get(id) || null;
  },

  async getSupplier(id: number): Promise<Supplier | null> {
    await this.delay(50);
    return this.suppliers.get(id) || null;
  },

  async getWidgetFeatures(widgetId: number): Promise<Feature[]> {
    await this.delay(75);
    const featureIds = this.widgetFeatures.get(widgetId) || [];
    return featureIds.map(id => this.features.get(id)!).filter(Boolean);
  },

  async getWidgetWithRelations(id: number): Promise<WidgetWithRelations | null> {
    const widget = await this.getWidget(id);
    if (!widget) return null;

    const [supplier, features] = await Promise.all([
      this.getSupplier(widget.supplierId),
      this.getWidgetFeatures(id),
    ]);

    return {
      ...widget,
      supplier: supplier || undefined,
      features,
    };
  },

  async getAllWidgets(limit?: number, offset?: number): Promise<{ widgets: Widget[]; total: number }> {
    await this.delay(150);
    const allWidgets = Array.from(this.widgets.values()) as Widget[];
    const sortedWidgets = allWidgets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : sortedWidgets.length;

    return {
      widgets: sortedWidgets.slice(startIndex, endIndex),
      total: sortedWidgets.length,
    };
  },

  async updateWidget(id: number, updates: Partial<Widget>): Promise<Widget | null> {
    await this.delay();
    const widget = this.widgets.get(id);
    if (!widget) return null;

    const updatedWidget = { ...widget, ...updates, updatedAt: new Date() };
    this.widgets.set(id, updatedWidget);
    return updatedWidget;
  },

  async deleteWidget(id: number): Promise<boolean> {
    await this.delay(75);
    const deleted = this.widgets.delete(id);
    if (deleted) {
      this.widgetFeatures.delete(id);
    }
    return deleted;
  },

  async createWidget(data: {
    name: string;
    description?: string;
    price: number;
    supplierId: number;
    featureIds?: number[];
  }): Promise<Widget> {
    await this.delay();

    const widget: Widget = {
      id: this.nextId++,
      name: data.name,
      description: data.description || '',
      price: data.price,
      supplierId: data.supplierId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.widgets.set(widget.id, widget);

    if (data.featureIds && data.featureIds.length > 0) {
      this.widgetFeatures.set(widget.id, data.featureIds);
    }

    return widget;
  },
};

// Initialize cache
const cache = AdvancedCache.getInstance({
  defaultTtl: 3600, // 1 hour
  defaultNamespace: 'widgets',
});

// Register warmup tasks
cache.registerWarmupTask({
  id: 'preload-popular-widgets',
  name: 'Preload Popular Widgets',
  description: 'Cache the most popular widgets to improve response times',
  priority: 1,
  execute: async () => {
    console.log('Warming up popular widgets cache...');

    // Preload popular widget IDs
    const popularWidgetIds = [1, 2]; // In real app, get from analytics

    for (const id of popularWidgetIds) {
      await getWidgetWithRelations(id);
    }

    console.log(`Preloaded ${popularWidgetIds.length} popular widgets`);
  },
});

cache.registerWarmupTask({
  id: 'cache-statistics',
  name: 'Log Cache Statistics',
  description: 'Log cache performance statistics',
  priority: 2,
  execute: async () => {
    const stats = cache.getStats();
    console.log('Cache Statistics:', stats);
  },
});

// Helper function to get widget with all relations (cached)
async function getWidgetWithRelations(id: number): Promise<WidgetWithRelations | null> {
  const cacheKey = `widget:${id}:full`;

  return cache.getOrSet(cacheKey, async () => {
    console.log(`📊 Fetching widget ${id} with relations from database...`);
    const widget = await mockDatabase.getWidgetWithRelations(id);
    return widget;
  }, { ttl: 3600, tags: ['widget', `widget:${id}`] });
}



// Express controller class
export class WidgetController {
  /**
   * Get a single widget with all relations
   */
  static async getWidget(req: Request, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (!idParam) {
        res.status(400).json({ error: 'Widget ID is required' });
        return;
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid widget ID' });
        return;
      }

      const widget = await getWidgetWithRelations(id);

      if (!widget) {
        res.status(404).json({ error: 'Widget not found' });
        return;
      }

      // Track widget views for analytics
      await cache.increment(`widget:${id}:views`, 1, { ttl: 86400 }); // 24 hours

      res.json(widget);
    } catch (error) {
      console.error('Error getting widget:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all widgets with pagination and caching
   */
  static async getAllWidgets(req: Request, res: Response): Promise<void> {
    try {
      const pageParam = req.query['page'] as string;
      const limitParam = req.query['limit'] as string;

      const page = pageParam ? parseInt(pageParam) : 1;
      const limit = limitParam ? parseInt(limitParam) : 10;
      const offset = (page - 1) * limit;
      const cacheKey = `widgets:page:${page}:limit:${limit}`;

      const result = await cache.getOrSet(cacheKey, async () => {
        console.log(`📊 Fetching widgets page ${page} from database...`);
        const { widgets, total } = await mockDatabase.getAllWidgets(limit, offset);

        return {
          widgets,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }, { ttl: 600, tags: ['widgets', 'pagination'] }); // 10 minutes

      res.json(result);
    } catch (error) {
      console.error('Error getting widgets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create a new widget
   */
  static async createWidget(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, price, supplier_id, featureIds } = req.body;

      if (!name || price === undefined || !supplier_id) {
        res.status(400).json({ error: 'Missing required fields: name, price, supplier_id' });
        return;
      }

      const widget = await mockDatabase.createWidget({
        name,
        description,
        price: parseFloat(price),
        supplierId: parseInt(supplier_id),
        featureIds: featureIds ? featureIds.map((id: string) => parseInt(id)) : undefined,
      });

      // Invalidate pagination cache
      await cache.clear({ tags: ['widgets', 'pagination'] });

      // Add to recently created list
      await cache.listPush('recently-created-widgets', widget.id, { ttl: 3600 });

      res.status(201).json(widget);
    } catch (error) {
      console.error('Error creating widget:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update a widget and invalidate related cache
   */
  static async updateWidget(req: Request, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (!idParam) {
        res.status(400).json({ error: 'Widget ID is required' });
        return;
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid widget ID' });
        return;
      }

      const updates = req.body;
      const updatedWidget = await mockDatabase.updateWidget(id, updates);

      if (!updatedWidget) {
        res.status(404).json({ error: 'Widget not found' });
        return;
      }

      // Invalidate related cache entries
      await Promise.all([
        cache.del(`widget:${id}:full`),
        cache.del(`widget:${id}:cached`),
        cache.clear({ tags: ['widgets', 'pagination'] }),
        cache.del(`widget:${id}:features`),
        cache.del(`supplier:${updatedWidget.supplierId}`), // Invalidate supplier cache if changed
      ]);

      // Add to recently updated list
      await cache.listPush('recently-updated-widgets', id, { ttl: 3600 });

      res.json(updatedWidget);
    } catch (error) {
      console.error('Error updating widget:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a widget and clean up cache
   */
  static async deleteWidget(req: Request, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (!idParam) {
        res.status(400).json({ error: 'Widget ID is required' });
        return;
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid widget ID' });
        return;
      }

      const success = await mockDatabase.deleteWidget(id);

      if (!success) {
        res.status(404).json({ error: 'Widget not found' });
        return;
      }

      // Clean up all related cache entries
      await Promise.all([
        cache.del(`widget:${id}:full`),
        cache.del(`widget:${id}:cached`),
        cache.del(`widget:${id}:features`),
        cache.del(`widget:${id}:views`),
        cache.clear({ tags: ['widgets', 'pagination'] }),
        cache.setRemove('active-widgets', id),
      ]);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting widget:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get widget analytics from cache
   */
  static async getWidgetAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (!idParam) {
        res.status(400).json({ error: 'Widget ID is required' });
        return;
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid widget ID' });
        return;
      }

      const [views, isPopular] = await Promise.all([
        cache.get(`widget:${id}:views`) || 0,
        cache.setContains('popular-widgets', id),
      ]);

      res.json({
        widgetId: id,
        views,
        isPopular,
      });
    } catch (error) {
      console.error('Error getting widget analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Trigger cache warmup
   */
  static async warmupCache(_req: Request, res: Response): Promise<void> {
    try {
      // Queue warmup tasks
      cache.queueWarmupTask('preload-popular-widgets', { priority: 1 });
      cache.queueWarmupTask('cache-statistics', { priority: 2 });

      res.json({ message: 'Cache warmup tasks queued successfully' });
    } catch (error) {
      console.error('Error warming up cache:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = cache.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Initialize cache warmup tasks
function initializeCache(): void {
  console.log('🔥 Setting up cache warmup tasks...');

  // Register warmup task for popular widgets
  cache.registerWarmupTask({
    id: 'preload-popular-widgets',
    name: 'Preload Popular Widgets',
    description: 'Cache popular widgets for better performance',
    priority: 1,
    execute: async () => {
      console.log('🔥 Warming up popular widgets cache...');

      // Cache the first few widgets
      const { widgets } = await mockDatabase.getAllWidgets(3, 0);
      for (const widget of widgets) {
        await cache.set(`widget:${widget.id}:full`, await mockDatabase.getWidgetWithRelations(widget.id), { ttl: 3600 });
      }

      console.log(`✅ Cached ${widgets.length} popular widgets`);
    },
  });

  // Register warmup task for cache statistics
  cache.registerWarmupTask({
    id: 'cache-statistics',
    name: 'Initialize Cache Statistics',
    description: 'Set up initial cache statistics and counters',
    priority: 2,
    execute: async () => {
      console.log('📊 Initializing cache statistics...');

      // Initialize some counters
      await cache.set('total-requests', 0, { ttl: 86400 });
      await cache.set('cache-hits', 0, { ttl: 86400 });

      console.log('✅ Cache statistics initialized');
    },
  });
}

// Express app setup
const app = express();
app.use(express.json());

// Widget routes
app.get('/widgets', WidgetController.getAllWidgets);
app.get('/widgets/:id', WidgetController.getWidget);
app.post('/widgets', WidgetController.createWidget);
app.put('/widgets/:id', WidgetController.updateWidget);
app.delete('/widgets/:id', WidgetController.deleteWidget);
app.get('/widgets/:id/analytics', WidgetController.getWidgetAnalytics);

// Cache management routes
app.post('/cache/warmup', WidgetController.warmupCache);
app.get('/cache/stats', WidgetController.getCacheStats);

// Dashboard route
app.get('/admin/cache/stats', renderFracheDashboard);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    database: 'mock-in-memory',
    cache: 'active',
    widgets: mockDatabase.widgets.size,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env['PORT'] || 3001;

async function startServer(): Promise<void> {
  try {
    // Initialize cache
    initializeCache();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('\n📋 Available endpoints:');
      console.log('  GET    /widgets - Get all widgets (paginated)');
      console.log('  GET    /widgets/:id - Get widget by ID');
      console.log('  POST   /widgets - Create new widget');
      console.log('  PUT    /widgets/:id - Update widget');
      console.log('  DELETE /widgets/:id - Delete widget');
      console.log('  GET    /widgets/:id/analytics - Get widget analytics');
      console.log('  POST   /cache/warmup - Trigger cache warmup');
      console.log('  GET    /cache/stats - Get cache statistics');
      console.log('  GET    /health - Health check');
      console.log('');
      console.log('🎛️  Dashboard:');
      console.log(`  GET    /admin/cache/stats - Frache Dashboard`);

      console.log('\n💾 Mock database initialized with sample data:');
      console.log(`   - ${mockDatabase.widgets.size} widgets`);
      console.log(`   - ${mockDatabase.suppliers.size} suppliers`);
      console.log(`   - ${mockDatabase.features.size} features`);

      // Queue initial warmup tasks
      cache.queueWarmupTask('preload-popular-widgets');
      cache.queueWarmupTask('cache-statistics');
      console.log('\n🔥 Initial cache warmup tasks queued');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
export { mockDatabase };
