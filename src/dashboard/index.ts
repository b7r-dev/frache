import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Request, Response } from 'express';
import FracheDashboard from './FracheDashboard';
import { AdvancedCache } from '../advanced-cache';

interface WarmupTask {
  id: string;
  name: string;
  description: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

interface DashboardData {
  stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
  };
  warmupTasks: WarmupTask[];
  recentKeys: string[];
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Creates a dashboard renderer function for a specific cache instance
 */
export function createFracheDashboard(cache: AdvancedCache) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Get cache statistics
      const stats = cache.getStats();
      
      // Get warmup tasks (mock data for now since we don't expose this from the cache)
      const warmupTasks: WarmupTask[] = [
        {
          id: 'preload-popular-widgets',
          name: 'Preload Popular Widgets',
          description: 'Cache popular widgets for better performance',
          priority: 1,
          status: 'completed',
          lastRun: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        },
        {
          id: 'cache-statistics',
          name: 'Initialize Cache Statistics',
          description: 'Set up initial cache statistics and counters',
          priority: 2,
          status: 'completed',
          lastRun: new Date(Date.now() - 300000).toISOString(),
        },
        {
          id: 'cleanup-expired',
          name: 'Cleanup Expired Keys',
          description: 'Remove expired cache entries to free memory',
          priority: 3,
          status: 'pending',
        },
      ];

      // Get recent cache keys (mock data - in a real implementation, 
      // you'd want to track this in the cache)
      const recentKeys = [
        'widget:1:full',
        'widgets:page:1:limit:10',
        'supplier:1',
        'widget:1:features',
        'widget:2:full',
        'cache-statistics',
        'total-requests',
        'widget:3:views',
        'popular-widgets',
        'recently-created-widgets',
      ];

      // Mock memory usage (in a real implementation, you'd get this from Redis)
      const memoryUsage = {
        used: 45,
        total: 512,
        percentage: (45 / 512) * 100,
      };

      const dashboardData: DashboardData = {
        stats,
        warmupTasks,
        recentKeys,
        memoryUsage,
      };

      // Render the React component to HTML
      const html = renderToStaticMarkup(
        React.createElement(FracheDashboard, {
          data: dashboardData,
          refreshUrl: req.originalUrl,
        })
      );

      // Send the HTML response
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html>${html}`);
    } catch (error) {
      console.error('Error rendering Frache dashboard:', error);
      res.status(500).json({ 
        error: 'Failed to render dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Default dashboard renderer using the singleton cache instance
 */
export function renderFracheDashboard(req: Request, res: Response): Promise<void> {
  const cache = AdvancedCache.getInstance();
  const renderer = createFracheDashboard(cache);
  return renderer(req, res);
}

// Export the dashboard component for custom usage
export { FracheDashboard };
export default renderFracheDashboard;
