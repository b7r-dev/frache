/**
 * Simple Express Example with Frache
 * 
 * This demonstrates basic cache usage in an Express application
 * without the complexity of Sequelize setup.
 */

import express, { Request, Response } from 'express';
import { AdvancedCache } from '../src';

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

// Mock database (in-memory)
const mockDatabase = {
  widgets: new Map<number, Widget>([
    [1, {
      id: 1,
      name: 'Super Widget',
      description: 'An amazing widget',
      price: 99.99,
      supplierId: 1,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-06-01'),
    }],
    [2, {
      id: 2,
      name: 'Basic Widget',
      description: 'A simple widget',
      price: 29.99,
      supplierId: 1,
      createdAt: new Date('2023-02-01'),
      updatedAt: new Date('2023-05-01'),
    }],
  ]),

  suppliers: new Map<number, Supplier>([
    [1, {
      id: 1,
      name: 'Widget Corp',
      email: 'contact@widgetcorp.com',
      country: 'USA',
    }],
  ]),

  async getWidget(id: number): Promise<Widget | null> {
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.widgets.get(id) || null;
  },

  async getSupplier(id: number): Promise<Supplier | null> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.suppliers.get(id) || null;
  },

  async getAllWidgets(): Promise<Widget[]> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return Array.from(this.widgets.values());
  },

  async updateWidget(id: number, updates: Partial<Widget>): Promise<Widget | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const widget = this.widgets.get(id);
    if (!widget) return null;
    
    const updatedWidget = { ...widget, ...updates, updatedAt: new Date() };
    this.widgets.set(id, updatedWidget);
    return updatedWidget;
  },

  async deleteWidget(id: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 75));
    return this.widgets.delete(id);
  },
};

// Initialize cache
const cache = AdvancedCache.getInstance({
  defaultTtl: 3600, // 1 hour
  defaultNamespace: 'widgets',
});

// Register warmup task
cache.registerWarmupTask({
  id: 'preload-widgets',
  name: 'Preload Popular Widgets',
  description: 'Cache popular widgets for better performance',
  priority: 1,
  execute: async () => {
    console.log('🔥 Warming up widget cache...');
    const widgets = await mockDatabase.getAllWidgets();
    for (const widget of widgets) {
      await cache.set(`widget:${widget.id}`, widget, { ttl: 3600 });
    }
    console.log(`✅ Cached ${widgets.length} widgets`);
  },
});

// Helper function for cache-aside pattern
async function getWidgetWithSupplier(id: number): Promise<(Widget & { supplier?: Supplier }) | null> {
  return cache.getOrSet(`widget:${id}:full`, async () => {
    console.log(`📊 Fetching widget ${id} from database...`);
    
    const widget = await mockDatabase.getWidget(id);
    if (!widget) return null;
    
    const supplier = await mockDatabase.getSupplier(widget.supplierId);
    
    return {
      ...widget,
      supplier: supplier || undefined,
    };
  }, { ttl: 1800, tags: ['widgets', `widget:${id}`] });
}

// Express app
const app = express();
app.use(express.json());

// Routes
app.get('/widgets', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 10;
    const cacheKey = `widgets:page:${page}:limit:${limit}`;
    
    const result = await cache.getOrSet(cacheKey, async () => {
      console.log('📊 Fetching widgets from database...');
      const allWidgets = await mockDatabase.getAllWidgets();
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      return {
        widgets: allWidgets.slice(startIndex, endIndex),
        total: allWidgets.length,
        page,
        limit,
        totalPages: Math.ceil(allWidgets.length / limit),
      };
    }, { ttl: 600 }); // 10 minutes
    
    res.json(result);
  } catch (error) {
    console.error('Error getting widgets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/widgets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid widget ID' });
      return;
    }
    
    const widget = await getWidgetWithSupplier(id);
    
    if (!widget) {
      res.status(404).json({ error: 'Widget not found' });
      return;
    }
    
    // Track views
    await cache.increment(`widget:${id}:views`, 1, { ttl: 86400 });
    
    res.json(widget);
  } catch (error) {
    console.error('Error getting widget:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/widgets/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string);
    
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
    
    // Invalidate cache
    await Promise.all([
      cache.del(`widget:${id}:full`),
      cache.clear({ tags: ['widgets'] }),
    ]);
    
    res.json(updatedWidget);
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/widgets/:id/analytics', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid widget ID' });
      return;
    }
    
    const views = await cache.get(`widget:${id}:views`) || 0;
    
    res.json({
      widgetId: id,
      views,
      cached: true,
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/cache/warmup', async (req: Request, res: Response) => {
  try {
    cache.queueWarmupTask('preload-widgets');
    res.json({ message: 'Cache warmup queued successfully' });
  } catch (error) {
    console.error('Error warming up cache:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = cache.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    cache: 'active',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env['PORT'] || 3000;

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('\n📋 Available endpoints:');
      console.log('  GET    /widgets - Get all widgets (paginated)');
      console.log('  GET    /widgets/:id - Get widget by ID');
      console.log('  PUT    /widgets/:id - Update widget');
      console.log('  GET    /widgets/:id/analytics - Get widget analytics');
      console.log('  POST   /cache/warmup - Trigger cache warmup');
      console.log('  GET    /cache/stats - Get cache statistics');
      console.log('  GET    /health - Health check');
      
      // Queue initial warmup
      cache.queueWarmupTask('preload-widgets');
      console.log('\n🔥 Initial cache warmup queued');
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
