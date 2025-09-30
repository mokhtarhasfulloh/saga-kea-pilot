import { useEffect, useState } from 'react'
import { HealthApi } from '../lib/healthApi'
import { HealthStatus } from '../components/HealthTile'
import HealthTile from '../components/HealthTile'
import RecentAuditLogs from '../components/RecentAuditLogs'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { subscribeWs } from '../hooks/useWs'

export default function Dashboard() {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadHealthStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const statuses = await HealthApi.getSystemHealth()
      setHealthStatuses(statuses)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to load health status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealthStatus()

    // Subscribe to real-time health updates via WebSocket
    const unsubscribe = subscribeWs('health-update', (message) => {
      console.log('🔌 Received health update:', message)
      if (message.type === 'health-update' && message.data) {
        const { service, status, ...healthData } = message.data

        // Update the specific service in the health statuses
        setHealthStatuses(prevStatuses => {
          const updatedStatuses = prevStatuses.map(health => {
            if (health.service === service) {
              return {
                ...health,
                status: status === 'healthy' ? 'healthy' : status === 'error' ? 'error' : 'warning',
                lastCheck: message.data.timestamp || new Date().toISOString(),
                ...healthData
              }
            }
            return health
          })

          // If service not found, add it
          if (!updatedStatuses.find(h => h.service === service)) {
            updatedStatuses.push({
              service,
              status: status === 'healthy' ? 'healthy' : status === 'error' ? 'error' : 'warning',
              lastCheck: message.data.timestamp || new Date().toISOString(),
              ...healthData
            })
          }

          return updatedStatuses
        })

        // Update last refresh time
        setLastRefresh(new Date())
      }
    })

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(loadHealthStatus, 30000)

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const handleRefresh = () => {
    loadHealthStatus()
  }

  const getOverallStatus = () => {
    if (healthStatuses.length === 0) return 'unknown'

    const hasError = healthStatuses.some(h => h.status === 'error')
    const hasWarning = healthStatuses.some(h => h.status === 'warning')

    if (hasError) return 'error'
    if (hasWarning) return 'warning'
    return 'healthy'
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Kea Pilot Dashboard</h1>
          <p className="text-gray-600 mt-1">
            System overview and health monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${
            overallStatus === 'healthy' ? 'bg-green-500' :
            overallStatus === 'warning' ? 'bg-yellow-500' :
            overallStatus === 'error' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          <div>
            <h3 className="font-semibold">
              System Status: {
                overallStatus === 'healthy' ? 'All Systems Operational' :
                overallStatus === 'warning' ? 'Some Issues Detected' :
                overallStatus === 'error' ? 'Critical Issues Detected' :
                'Status Unknown'
              }
            </h3>
            <p className="text-sm text-gray-600">
              {healthStatuses.filter(h => h.status === 'healthy').length} of {healthStatuses.length} services healthy
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-800">
            <h4 className="font-medium">Error loading health status</h4>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </Card>
      )}

      {/* Health Tiles */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Service Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthStatuses.map((health) => (
            <HealthTile key={health.service} health={health} />
          ))}
        </div>
      </div>

      {loading && healthStatuses.length === 0 && (
        <Card className="p-8">
          <div className="text-center text-gray-600">
            Loading system health status...
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <RecentAuditLogs limit={8} showHeader={false} />
      </div>
    </div>
  )
}

