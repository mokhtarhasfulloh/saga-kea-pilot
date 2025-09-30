import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface HaStatus {
  'local-state': string
  'partner-state': string
  'communication-interrupted': boolean
  'in-touch': boolean
  'partner-scopes': string[]
  'local-scopes': string[]
  'last-scopes-update': string
  'last-failover-time': string
  'failover-reason': string
}

interface HaServerStatus {
  'server-name': string
  'local-state': string
  'partner-state': string
  'communication-interrupted': boolean
  'in-touch': boolean
  'role': string
  'scopes': string[]
  'age': number
}

export default function HaStatusTab() {
  const [haStatus, setHaStatus] = useState<HaStatus | null>(null)
  const [serverStatuses, setServerStatuses] = useState<HaServerStatus[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function loadHaStatus() {
    setLoading(true)
    setError('')
    try {
      // Get HA status
      const statusResult = await caCall('ha-heartbeat', 'dhcp4')
      if (statusResult.result === 0) {
        setHaStatus(statusResult.arguments)
      }

      // Get server statuses
      const serversResult = await caCall('ha-scopes', 'dhcp4')
      if (serversResult.result === 0) {
        setServerStatuses(serversResult.arguments?.servers || [])
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatus() {
    setRefreshing(true)
    await loadHaStatus()
    setRefreshing(false)
  }

  useEffect(() => {
    loadHaStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHaStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  function getStateColor(state: string): string {
    switch (state.toLowerCase()) {
      case 'hot-standby':
      case 'load-balancing':
        return 'text-green-600 dark:text-green-400'
      case 'syncing':
      case 'ready':
        return 'text-blue-600 dark:text-blue-400'
      case 'unavailable':
      case 'terminated':
        return 'text-red-600 dark:text-red-400'
      case 'waiting':
      case 'partner-down':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  function getStateDescription(state: string): string {
    switch (state.toLowerCase()) {
      case 'hot-standby':
        return 'Server is in hot-standby mode, ready to take over'
      case 'load-balancing':
        return 'Server is actively load balancing with peers'
      case 'syncing':
        return 'Server is synchronizing with peers'
      case 'ready':
        return 'Server is ready and operational'
      case 'unavailable':
        return 'Server is not available or unreachable'
      case 'terminated':
        return 'Server has been terminated'
      case 'waiting':
        return 'Server is waiting for peer response'
      case 'partner-down':
        return 'Partner server is down, this server is handling all traffic'
      default:
        return 'Unknown state'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading HA status...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">High Availability Status</h2>
          <p className="text-sm text-gray-600">
            Monitor HA cluster health and server states
          </p>
        </div>
        <Button onClick={refreshStatus} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Overall HA Status */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Cluster Overview</h3>
        </CardHeader>
        <CardContent>
          {haStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Local State</div>
                  <div className={`text-sm font-medium ${getStateColor(haStatus['local-state'])}`}>
                    {haStatus['local-state']}
                  </div>
                  <div className="text-xs text-gray-500">
                    {getStateDescription(haStatus['local-state'])}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Partner State</div>
                  <div className={`text-sm font-medium ${getStateColor(haStatus['partner-state'])}`}>
                    {haStatus['partner-state']}
                  </div>
                  <div className="text-xs text-gray-500">
                    {getStateDescription(haStatus['partner-state'])}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Communication</div>
                  <div className={`text-sm ${haStatus['communication-interrupted'] ? 'text-red-600' : 'text-green-600'}`}>
                    {haStatus['communication-interrupted'] ? 'Interrupted' : 'Normal'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">In Touch</div>
                  <div className={`text-sm ${haStatus['in-touch'] ? 'text-green-600' : 'text-red-600'}`}>
                    {haStatus['in-touch'] ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Scope Distribution</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Local Scopes</div>
                    <div className="text-sm">
                      {haStatus['local-scopes']?.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Partner Scopes</div>
                    <div className="text-sm">
                      {haStatus['partner-scopes']?.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              </div>

              {haStatus['last-failover-time'] && (
                <div>
                  <div className="text-sm font-medium">Last Failover</div>
                  <div className="text-sm text-gray-600">
                    {new Date(haStatus['last-failover-time']).toLocaleString()}
                  </div>
                  {haStatus['failover-reason'] && (
                    <div className="text-xs text-gray-500">
                      Reason: {haStatus['failover-reason']}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">HA Status Not Available</div>
              <div className="text-sm">High Availability may not be configured or enabled</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Status Details */}
      {serverStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Server Details</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Tr>
                  <Th>Server Name</Th>
                  <Th>Role</Th>
                  <Th>Local State</Th>
                  <Th>Partner State</Th>
                  <Th>Communication</Th>
                  <Th>Scopes</Th>
                  <Th>Age</Th>
                </Tr>
              </Thead>
              <Tbody>
                {serverStatuses.map((server, i) => (
                  <Tr key={i}>
                    <Td className="font-medium">{server['server-name']}</Td>
                    <Td className="capitalize">{server.role}</Td>
                    <Td className={getStateColor(server['local-state'])}>
                      {server['local-state']}
                    </Td>
                    <Td className={getStateColor(server['partner-state'])}>
                      {server['partner-state']}
                    </Td>
                    <Td>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          server['communication-interrupted'] ? 'bg-red-500' : 'bg-green-500'
                        }`} />
                        <span className="text-sm">
                          {server['in-touch'] ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        {server.scopes?.join(', ') || 'None'}
                      </div>
                    </Td>
                    <Td className="text-sm">
                      {server.age ? `${Math.floor(server.age / 1000)}s` : 'N/A'}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* HA Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${
                haStatus && !haStatus['communication-interrupted'] ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                <div className="font-medium">Communication</div>
                <div className="text-sm text-gray-600">
                  {haStatus && !haStatus['communication-interrupted'] ? 'Healthy' : 'Issues Detected'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${
                haStatus && haStatus['in-touch'] ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                <div className="font-medium">Peer Connectivity</div>
                <div className="text-sm text-gray-600">
                  {haStatus && haStatus['in-touch'] ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${
                serverStatuses.length > 0 ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              <div>
                <div className="font-medium">Active Servers</div>
                <div className="text-sm text-gray-600">
                  {serverStatuses.length} server{serverStatuses.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">HA Status Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Hot-Standby:</strong> One server active, others ready for failover</div>
          <div>• <strong>Load-Balancing:</strong> Multiple servers sharing client requests</div>
          <div>• <strong>Partner-Down:</strong> Partner unavailable, local server handling all traffic</div>
          <div>• <strong>Syncing:</strong> Servers synchronizing lease databases</div>
          <div>• <strong>Scopes:</strong> Hash-based client distribution (load balancing mode)</div>
        </div>
      </div>
    </div>
  )
}
