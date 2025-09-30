import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'

interface PerformanceMetrics {
  timestamp: string
  queryCount: number
  responseTime: number
  errorRate: number
  cacheHitRate: number
  recursiveQueries: number
  authorityQueries: number
}

interface QueryStats {
  recordType: string
  count: number
  percentage: number
  avgResponseTime: number
}

interface ServerHealth {
  server: string
  status: 'healthy' | 'warning' | 'critical'
  uptime: number
  load: number
  memory: number
  connections: number
  lastCheck: string
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  timestamp: string
  acknowledged: boolean
}

export default function DnsMonitoringTab() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [queryStats, setQueryStats] = useState<QueryStats[]>([])
  const [serverHealth, setServerHealth] = useState<ServerHealth[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const loadMonitoringData = async () => {
    setLoading(true)
    
    try {
      // Generate mock performance metrics
      const now = Date.now()
      const interval = timeRange === '1h' ? 60000 : timeRange === '6h' ? 360000 : timeRange === '24h' ? 1440000 : 10080000
      const points = timeRange === '1h' ? 60 : timeRange === '6h' ? 60 : timeRange === '24h' ? 24 : 7
      
      const mockMetrics: PerformanceMetrics[] = []
      for (let i = points; i >= 0; i--) {
        mockMetrics.push({
          timestamp: new Date(now - (i * interval)).toISOString(),
          queryCount: Math.floor(Math.random() * 1000) + 500,
          responseTime: Math.random() * 50 + 10,
          errorRate: Math.random() * 5,
          cacheHitRate: Math.random() * 20 + 70,
          recursiveQueries: Math.floor(Math.random() * 300) + 100,
          authorityQueries: Math.floor(Math.random() * 700) + 400
        })
      }
      setMetrics(mockMetrics)
      
      // Mock query statistics
      const mockQueryStats: QueryStats[] = [
        { recordType: 'A', count: 45230, percentage: 65.2, avgResponseTime: 12.5 },
        { recordType: 'AAAA', count: 12450, percentage: 17.9, avgResponseTime: 15.2 },
        { recordType: 'CNAME', count: 5670, percentage: 8.2, avgResponseTime: 11.8 },
        { recordType: 'MX', count: 3210, percentage: 4.6, avgResponseTime: 18.3 },
        { recordType: 'TXT', count: 1890, percentage: 2.7, avgResponseTime: 14.7 },
        { recordType: 'NS', count: 980, percentage: 1.4, avgResponseTime: 16.1 }
      ]
      setQueryStats(mockQueryStats)
      
      // Mock server health
      const mockServerHealth: ServerHealth[] = [
        {
          server: 'ns1.example.com',
          status: 'healthy',
          uptime: 99.98,
          load: 0.45,
          memory: 68.2,
          connections: 1247,
          lastCheck: new Date().toISOString()
        },
        {
          server: 'ns2.example.com',
          status: 'warning',
          uptime: 99.85,
          load: 0.78,
          memory: 84.1,
          connections: 1456,
          lastCheck: new Date().toISOString()
        }
      ]
      setServerHealth(mockServerHealth)
      
      // Mock alerts
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'warning',
          message: 'High memory usage on ns2.example.com (84.1%)',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          acknowledged: false
        },
        {
          id: '2',
          type: 'info',
          message: 'DNS cache hit rate improved to 89.2%',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          acknowledged: true
        }
      ]
      setAlerts(mockAlerts)
      
    } catch (error: any) {
      toast.error('Load Failed', error.message || 'Failed to load monitoring data')
    } finally {
      setLoading(false)
    }
  }

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
    toast.success('Alert Acknowledged', 'Alert has been acknowledged')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-100 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'info': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  useEffect(() => {
    loadMonitoringData()
  }, [timeRange])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadMonitoringData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, timeRange])

  const currentMetrics = metrics[metrics.length - 1]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">DNS Performance Monitoring</h3>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>
          <Button onClick={loadMonitoringData} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatNumber(currentMetrics.queryCount)}</div>
              <div className="text-sm text-gray-600">Queries/min</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{currentMetrics.responseTime.toFixed(1)}ms</div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{currentMetrics.cacheHitRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Cache Hit Rate</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{currentMetrics.errorRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{formatNumber(currentMetrics.recursiveQueries)}</div>
              <div className="text-sm text-gray-600">Recursive</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">{formatNumber(currentMetrics.authorityQueries)}</div>
              <div className="text-sm text-gray-600">Authoritative</div>
            </div>
          </Card>
        </div>
      )}

      {/* Performance Charts Placeholder */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Performance Trends</h4>
        <div className="h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-lg mb-2">📊 Performance Charts</div>
            <div className="text-sm">Charts would be rendered here using a charting library</div>
            <div className="text-xs mt-2">
              Query Volume • Response Time • Error Rate • Cache Performance
            </div>
          </div>
        </div>
      </Card>

      {/* Query Statistics */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Query Statistics by Record Type</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Record Type</th>
                <th className="text-left p-3 font-medium">Query Count</th>
                <th className="text-left p-3 font-medium">Percentage</th>
                <th className="text-left p-3 font-medium">Avg Response Time</th>
                <th className="text-left p-3 font-medium">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {queryStats.map((stat) => (
                <tr key={stat.recordType} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono font-medium">{stat.recordType}</td>
                  <td className="p-3">{formatNumber(stat.count)}</td>
                  <td className="p-3">{stat.percentage}%</td>
                  <td className="p-3">{stat.avgResponseTime}ms</td>
                  <td className="p-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${stat.percentage}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Server Health */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Server Health Status</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Server</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Uptime</th>
                <th className="text-left p-3 font-medium">Load</th>
                <th className="text-left p-3 font-medium">Memory</th>
                <th className="text-left p-3 font-medium">Connections</th>
                <th className="text-left p-3 font-medium">Last Check</th>
              </tr>
            </thead>
            <tbody>
              {serverHealth.map((server) => (
                <tr key={server.server} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-sm">{server.server}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(server.status)}`}>
                      {server.status}
                    </span>
                  </td>
                  <td className="p-3">{server.uptime}%</td>
                  <td className="p-3">{server.load.toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex items-center">
                      <span className={`${server.memory > 80 ? 'text-red-600' : server.memory > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {server.memory.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">{server.connections}</td>
                  <td className="p-3 text-sm">
                    {new Date(server.lastCheck).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-4">Recent Alerts</h4>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-3 border rounded-lg ${getAlertColor(alert.type)} ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-sm mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
