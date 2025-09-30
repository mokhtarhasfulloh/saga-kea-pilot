import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

interface StatisticsSnapshot {
  timestamp: number
  'pkt4-received': number
  'pkt4-sent': number
  'pkt4-discover-received': number
  'pkt4-offer-sent': number
  'pkt4-request-received': number
  'pkt4-ack-sent': number
  'pkt4-nak-sent': number
  'pkt4-decline-received': number
  'pkt4-parse-failed': number
  'pkt4-receive-drop': number
}

export default function PerformanceChartsTab() {
  const [snapshots, setSnapshots] = useState<StatisticsSnapshot[]>([])
  const [error, setError] = useState('')
  // const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  async function collectSnapshot() {
    try {
      const result = await caCall('statistic-get-all', 'dhcp4')
      if (result.result === 0 && result.arguments) {
        const snapshot: StatisticsSnapshot = {
          timestamp: Date.now(),
          'pkt4-received': result.arguments['pkt4-received'] || 0,
          'pkt4-sent': result.arguments['pkt4-sent'] || 0,
          'pkt4-discover-received': result.arguments['pkt4-discover-received'] || 0,
          'pkt4-offer-sent': result.arguments['pkt4-offer-sent'] || 0,
          'pkt4-request-received': result.arguments['pkt4-request-received'] || 0,
          'pkt4-ack-sent': result.arguments['pkt4-ack-sent'] || 0,
          'pkt4-nak-sent': result.arguments['pkt4-nak-sent'] || 0,
          'pkt4-decline-received': result.arguments['pkt4-decline-received'] || 0,
          'pkt4-parse-failed': result.arguments['pkt4-parse-failed'] || 0,
          'pkt4-receive-drop': result.arguments['pkt4-receive-drop'] || 0
        }
        
        setSnapshots(prev => {
          const newSnapshots = [...prev, snapshot]
          // Keep only last 50 snapshots
          return newSnapshots.slice(-50)
        })
      }
    } catch (e: any) {
      setError(String(e))
    }
  }

  async function manualSnapshot() {
    setCollecting(true)
    await collectSnapshot()
    setCollecting(false)
  }

  useEffect(() => {
    // Initial snapshot
    collectSnapshot()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(collectSnapshot, 10000) // Every 10 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  function calculateRate(current: number, previous: number, timeDiff: number): number {
    if (timeDiff === 0) return 0
    return Math.max(0, (current - previous) / (timeDiff / 1000)) // per second
  }

  function renderSimpleChart(data: Array<{ time: string; value: number }>, title: string, color: string) {
    if (data.length < 2) {
      return (
        <div className="text-center py-8 text-gray-500">
          <div className="text-sm">Insufficient data for chart</div>
          <div className="text-xs">Collect more snapshots to see trends</div>
        </div>
      )
    }

    const maxValue = Math.max(...data.map(d => d.value))
    const minValue = Math.min(...data.map(d => d.value))
    const range = maxValue - minValue || 1

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{title}</span>
          <span className="text-gray-500">
            Max: {maxValue.toFixed(1)}/s
          </span>
        </div>
        <div className="h-24 flex items-end space-x-1">
          {data.map((point, i) => {
            const height = ((point.value - minValue) / range) * 100
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end"
                title={`${point.time}: ${point.value.toFixed(1)}/s`}
              >
                <div
                  className={`${color} rounded-t`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{data[0]?.time}</span>
          <span>{data[data.length - 1]?.time}</span>
        </div>
      </div>
    )
  }

  // Calculate rates between snapshots
  const chartData = snapshots.length >= 2 ? snapshots.slice(1).map((snapshot, i) => {
    const prev = snapshots[i]
    const timeDiff = snapshot.timestamp - prev.timestamp
    
    return {
      time: new Date(snapshot.timestamp).toLocaleTimeString(),
      received: calculateRate(snapshot['pkt4-received'], prev['pkt4-received'], timeDiff),
      sent: calculateRate(snapshot['pkt4-sent'], prev['pkt4-sent'], timeDiff),
      discover: calculateRate(snapshot['pkt4-discover-received'], prev['pkt4-discover-received'], timeDiff),
      request: calculateRate(snapshot['pkt4-request-received'], prev['pkt4-request-received'], timeDiff),
      ack: calculateRate(snapshot['pkt4-ack-sent'], prev['pkt4-ack-sent'], timeDiff),
      nak: calculateRate(snapshot['pkt4-nak-sent'], prev['pkt4-nak-sent'], timeDiff),
      errors: calculateRate(
        (snapshot['pkt4-parse-failed'] + snapshot['pkt4-receive-drop']),
        (prev['pkt4-parse-failed'] + prev['pkt4-receive-drop']),
        timeDiff
      )
    }
  }) : []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Performance Charts</h2>
          <p className="text-sm text-muted-foreground">
            Real-time DHCP packet rate monitoring and trends
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            <span className="text-sm">Auto-refresh (10s)</span>
          </label>
          <Button onClick={manualSnapshot} disabled={collecting}>
            {collecting ? 'Collecting...' : 'Take Snapshot'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Status */}
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span>Auto-refresh: {autoRefresh ? 'On' : 'Off'}</span>
        </div>
        <div>Snapshots: {snapshots.length}</div>
        <div>
          Data window: {snapshots.length >= 2 ? 
            `${Math.round((snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) / 60000)}min` : 
            'N/A'
          }
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-medium">Packet Rates</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.received })),
              'Packets Received/sec',
              'bg-blue-500'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Response Rates</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.sent })),
              'Responses Sent/sec',
              'bg-green-500'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Discovery Requests</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.discover })),
              'DISCOVER Messages/sec',
              'bg-purple-500'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Lease Requests</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.request })),
              'REQUEST Messages/sec',
              'bg-indigo-500'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">ACK Responses</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.ack })),
              'ACK Messages/sec',
              'bg-green-600'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Error Rate</h3>
          </CardHeader>
          <CardContent>
            {renderSimpleChart(
              chartData.map(d => ({ time: d.time, value: d.errors })),
              'Errors + Drops/sec',
              'bg-red-500'
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Rates Summary */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Current Rates (per second)</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {chartData[chartData.length - 1]?.received.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Received</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {chartData[chartData.length - 1]?.sent.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {chartData[chartData.length - 1]?.discover.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Discover</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {chartData[chartData.length - 1]?.errors.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Performance Monitoring Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Packet Rates:</strong> Monitor incoming DHCP traffic patterns</div>
          <div>• <strong>Response Rates:</strong> Track server response performance</div>
          <div>• <strong>Error Monitoring:</strong> Watch for parse failures and dropped packets</div>
          <div>• <strong>Baseline:</strong> Establish normal traffic patterns for capacity planning</div>
          <div>• <strong>Alerts:</strong> Set thresholds for high error rates or traffic spikes</div>
        </div>
      </div>
    </div>
  )
}
