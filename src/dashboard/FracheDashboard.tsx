import React from 'react';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate?: number;
  totalOperations?: number;
}

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
  stats: CacheStats;
  warmupTasks: WarmupTask[];
  recentKeys: string[];
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface FracheDashboardProps {
  data: DashboardData;
  refreshUrl?: string;
}

const FracheDashboard: React.FC<FracheDashboardProps> = ({ data }) => {
  const { stats, warmupTasks, recentKeys, memoryUsage } = data;

  // Calculate derived stats
  const totalOps = stats.hits + stats.misses;
  const hitRate = totalOps > 0 ? (stats.hits / totalOps * 100) : 0;

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'running': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Frache Dashboard</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .dashboard {
            max-width: 1200px;
            margin: 0 auto;
          }

          .header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
          }

          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }

          .header p {
            font-size: 1.1rem;
            opacity: 0.9;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }

          .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
          }

          .card:hover {
            transform: translateY(-2px);
          }

          .card h2 {
            font-size: 1.25rem;
            margin-bottom: 16px;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .stat-item {
            text-align: center;
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
          }

          .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 0.875rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .hit-rate {
            font-size: 3rem;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
          }

          .hit-rate.good { color: #10b981; }
          .hit-rate.medium { color: #f59e0b; }
          .hit-rate.poor { color: #ef4444; }

          .progress-bar {
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin: 12px 0;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            transition: width 0.3s ease;
          }

          .task-list {
            list-style: none;
          }

          .task-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .task-item:last-child {
            border-bottom: none;
          }

          .task-info h3 {
            font-size: 1rem;
            color: #1f2937;
            margin-bottom: 4px;
          }

          .task-info p {
            font-size: 0.875rem;
            color: #6b7280;
          }

          .task-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            color: white;
          }

          .key-list {
            list-style: none;
            max-height: 200px;
            overflow-y: auto;
          }

          .key-item {
            padding: 8px 12px;
            margin: 4px 0;
            background: #f3f4f6;
            border-radius: 6px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.875rem;
            color: #374151;
          }

          .refresh-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: none;
            border-radius: 50px;
            padding: 12px 24px;
            font-weight: 600;
            color: #667eea;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-block;
          }

          .refresh-btn:hover {
            background: #667eea;
            color: white;
            transform: translateY(-1px);
          }

          .icon {
            width: 20px;
            height: 20px;
          }

          @media (max-width: 768px) {
            .grid {
              grid-template-columns: 1fr;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .header h1 {
              font-size: 2rem;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="dashboard">
          <div className="header">
            <h1>🚀 Frache Dashboard</h1>
            <p>Advanced Caching Performance & Management</p>
          </div>

          <a
            href="."
            className="refresh-btn"
          >
            🔄 Refresh
          </a>

          <div className="grid">
            {/* Cache Statistics */}
            <div className="card">
              <h2>
                📊 Cache Statistics
              </h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{formatNumber(stats.hits)}</div>
                  <div className="stat-label">Hits</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{formatNumber(stats.misses)}</div>
                  <div className="stat-label">Misses</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{formatNumber(stats.sets)}</div>
                  <div className="stat-label">Sets</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{formatNumber(stats.deletes)}</div>
                  <div className="stat-label">Deletes</div>
                </div>
              </div>
            </div>

            {/* Hit Rate */}
            <div className="card">
              <h2>🎯 Hit Rate</h2>
              <div className={`hit-rate ${hitRate >= 80 ? 'good' : hitRate >= 50 ? 'medium' : 'poor'}`}>
                {formatPercentage(hitRate)}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${hitRate}%` }}
                ></div>
              </div>
              <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                {formatNumber(totalOps)} total operations
              </p>
            </div>

            {/* Memory Usage */}
            {memoryUsage && (
              <div className="card">
                <h2>💾 Memory Usage</h2>
                <div className="stat-item">
                  <div className="stat-value">{formatPercentage(memoryUsage.percentage)}</div>
                  <div className="stat-label">Used</div>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${memoryUsage.percentage}%` }}
                  ></div>
                </div>
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                  {formatNumber(memoryUsage.used)} / {formatNumber(memoryUsage.total)} MB
                </p>
              </div>
            )}

            {/* Warmup Tasks */}
            <div className="card">
              <h2>🔥 Warmup Tasks</h2>
              <ul className="task-list">
                {warmupTasks.map((task) => (
                  <li key={task.id} className="task-item">
                    <div className="task-info">
                      <h3>{task.name}</h3>
                      <p>{task.description}</p>
                    </div>
                    <div
                      className="task-status"
                      style={{ backgroundColor: getStatusColor(task.status) }}
                    >
                      {task.status}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Keys */}
            <div className="card">
              <h2>🔑 Recent Cache Keys</h2>
              <ul className="key-list">
                {recentKeys.map((key, index) => (
                  <li key={index} className="key-item">
                    {key}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <script>{`
          // Auto-refresh every 30 seconds
          setTimeout(() => {
            window.location.reload();
          }, 30000);
        `}</script>
      </body>
    </html>
  );
};

export default FracheDashboard;
