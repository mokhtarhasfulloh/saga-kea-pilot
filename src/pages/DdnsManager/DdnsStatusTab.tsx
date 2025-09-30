import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface DdnsStatus {
  enabled: boolean
  daemon_connected: boolean
  queue_size: number
  updates_sent: number
  updates_successful: number
  updates_failed: number
  last_update: string
}

interface DdnsUpdate {
  timestamp: string
  fqdn: string
  ip_address: string
  type: 'A' | 'PTR' | 'AAAA'
  operation: 'ADD' | 'REMOVE' | 'UPDATE'
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  error?: string
}

export default function DdnsStatusTab() {
  const [ddnsStatus, setDdnsStatus] = useState<DdnsStatus | null>(null)
  const [recentUpdates, setRecentUpdates] = useState<DdnsUpdate[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  async function loadDdnsStatus() {
    setLoading(true)
    setError('')
    try {
      // Get DDNS statistics (if available)
      const statsResult = await caCall('statistic-get-all', 'dhcp4')
      if (statsResult.result === 0 && statsResult.arguments) {
        const stats = statsResult.arguments
        
        // Extract DDNS-related statistics
        const status: DdnsStatus = {
          enabled: true, // We'll determine this from config
          daemon_connected: true, // Assume connected if we get stats
          queue_size: stats['ddns-queue-size'] || 0,
          updates_sent: stats['ddns-updates-sent'] || 0,
          updates_successful: stats['ddns-updates-successful'] || 0,
          updates_failed: stats['ddns-updates-failed'] || 0,
          last_update: new Date().toISOString()
        }
        
        setDdnsStatus(status)
      }

      // TODO: Implement real DDNS update history API
      // For now, show empty state until DDNS logging is implemented
      setRecentUpdates([])
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatus() {
    setRefreshing(true)
    await loadDdnsStatus()
    setRefreshing(false)
  }

  useEffect(() => {
    loadDdnsStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDdnsStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  function getStatusColor(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600'
      case 'FAILED':
        return 'text-red-600'
      case 'PENDING':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  function getOperationColor(operation: string): string {
    switch (operation) {
      case 'ADD':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'REMOVE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading DDNS status...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">DDNS Status & Activity</h2>
          <p className="text-sm text-gray-600">
            Monitor Dynamic DNS update status and recent activity
          </p>
          {lastRefresh && (
            <p className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={refreshStatus} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {ddnsStatus ? (
        <>
          {/* DDNS Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${
                    ddnsStatus.enabled ? 'bg-green-500' : 'bg-gray-500'
                  }`} />
                  <div>
                    <div className="font-medium">DDNS Status</div>
                    <div className="text-sm text-gray-600">
                      {ddnsStatus.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {ddnsStatus.queue_size}
                </div>
                <div className="text-sm text-gray-600">Queue Size</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {ddnsStatus.updates_successful}
                </div>
                <div className="text-sm text-gray-600">Successful Updates</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {ddnsStatus.updates_failed}
                </div>
                <div className="text-sm text-gray-600">Failed Updates</div>
              </CardContent>
            </Card>
          </div>

          {/* DDNS Health Indicators */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">DDNS Health</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${
                    ddnsStatus.daemon_connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="font-medium">DDNS Daemon</div>
                    <div className="text-sm text-gray-600">
                      {ddnsStatus.daemon_connected ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${
                    ddnsStatus.queue_size < 100 ? 'bg-green-500' : 
                    ddnsStatus.queue_size < 500 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="font-medium">Queue Health</div>
                    <div className="text-sm text-gray-600">
                      {ddnsStatus.queue_size < 100 ? 'Normal' : 
                       ddnsStatus.queue_size < 500 ? 'High' : 'Critical'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${
                    ddnsStatus.updates_failed === 0 ? 'bg-green-500' :
                    ddnsStatus.updates_failed < 10 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="font-medium">Error Rate</div>
                    <div className="text-sm text-gray-600">
                      {ddnsStatus.updates_failed === 0 ? 'No Errors' :
                       ddnsStatus.updates_failed < 10 ? 'Low' : 'High'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent DDNS Updates */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Recent DNS Updates</h3>
            </CardHeader>
            <CardContent>
              {recentUpdates.length > 0 ? (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Timestamp</Th>
                      <Th>FQDN</Th>
                      <Th>IP Address</Th>
                      <Th>Type</Th>
                      <Th>Operation</Th>
                      <Th>Status</Th>
                      <Th>Error</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {recentUpdates.map((update, i) => (
                      <Tr key={i}>
                        <Td className="text-sm">{formatTimestamp(update.timestamp)}</Td>
                        <Td className="font-mono text-sm">{update.fqdn}</Td>
                        <Td className="font-mono text-sm">{update.ip_address}</Td>
                        <Td>
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            {update.type}
                          </span>
                        </Td>
                        <Td>
                          <span className={`px-2 py-1 rounded text-xs ${getOperationColor(update.operation)}`}>
                            {update.operation}
                          </span>
                        </Td>
                        <Td className={getStatusColor(update.status)}>
                          {update.status}
                        </Td>
                        <Td className="text-sm text-red-600">
                          {update.error || '-'}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-lg mb-2">No Recent Updates</div>
                  <div className="text-sm">No DDNS updates have been recorded recently</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics Summary */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Update Statistics</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {ddnsStatus.updates_sent}
                  </div>
                  <div className="text-sm text-gray-600">Total Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {ddnsStatus.updates_successful}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {ddnsStatus.updates_failed}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {ddnsStatus.updates_sent > 0 ? 
                      Math.round((ddnsStatus.updates_successful / ddnsStatus.updates_sent) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              <div className="text-lg mb-2">DDNS Status Not Available</div>
              <div className="text-sm">DDNS may not be configured or enabled</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DDNS Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">DDNS Status Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Queue Size:</strong> Number of pending DNS updates (should be low)</div>
          <div>• <strong>Success Rate:</strong> Percentage of successful DNS updates (should be &gt;95%)</div>
          <div>• <strong>Update Types:</strong> A (forward), PTR (reverse), AAAA (IPv6 forward)</div>
          <div>• <strong>Operations:</strong> ADD (new), UPDATE (change), REMOVE (delete)</div>
          <div>• <strong>Troubleshooting:</strong> Check DNS server logs for failed updates</div>
        </div>
      </div>
    </div>
  )
}
