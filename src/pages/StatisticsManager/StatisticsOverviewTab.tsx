import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

// interface Statistic {
//   name: string
//   value: number
//   description?: string
// }

interface StatisticsData {
  'pkt4-received': number
  'pkt4-discover-received': number
  'pkt4-offer-sent': number
  'pkt4-request-received': number
  'pkt4-ack-sent': number
  'pkt4-nak-sent': number
  'pkt4-release-received': number
  'pkt4-decline-received': number
  'pkt4-inform-received': number
  'pkt4-unknown-received': number
  'pkt4-sent': number
  'pkt4-parse-failed': number
  'pkt4-receive-drop': number
  'subnet[1].total-addresses': number
  'subnet[1].assigned-addresses': number
  'subnet[1].declined-addresses': number
  [key: string]: number
}

export default function StatisticsOverviewTab() {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  async function loadStatistics() {
    setLoading(true)
    setError('')
    try {
      const result = await caCall('statistic-get-all', 'dhcp4')
      if (result.result === 0 && result.arguments) {
        setStatistics(result.arguments)
        setLastUpdate(new Date())
      } else {
        setError('Failed to retrieve statistics')
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatistics() {
    setRefreshing(true)
    await loadStatistics()
    setRefreshing(false)
  }

  useEffect(() => {
    loadStatistics()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStatistics, 30000)
    return () => clearInterval(interval)
  }, [])

  function formatNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  function calculateUtilization(total: number, assigned: number): number {
    if (total === 0) return 0
    return Math.round((assigned / total) * 100)
  }

  function getUtilizationColor(percentage: number): string {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400'
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400'
    if (percentage >= 50) return 'text-blue-600 dark:text-blue-400'
    return 'text-green-600 dark:text-green-400'
  }

  const packetStats = statistics ? [
    { name: 'Total Received', value: statistics['pkt4-received'] || 0, description: 'All DHCPv4 packets received' },
    { name: 'Discover', value: statistics['pkt4-discover-received'] || 0, description: 'DHCPDISCOVER messages' },
    { name: 'Request', value: statistics['pkt4-request-received'] || 0, description: 'DHCPREQUEST messages' },
    { name: 'Release', value: statistics['pkt4-release-received'] || 0, description: 'DHCPRELEASE messages' },
    { name: 'Decline', value: statistics['pkt4-decline-received'] || 0, description: 'DHCPDECLINE messages' },
    { name: 'Inform', value: statistics['pkt4-inform-received'] || 0, description: 'DHCPINFORM messages' },
    { name: 'Unknown', value: statistics['pkt4-unknown-received'] || 0, description: 'Unknown packet types' },
    { name: 'Parse Failed', value: statistics['pkt4-parse-failed'] || 0, description: 'Malformed packets' },
    { name: 'Dropped', value: statistics['pkt4-receive-drop'] || 0, description: 'Dropped packets' }
  ] : []

  const responseStats = statistics ? [
    { name: 'Total Sent', value: statistics['pkt4-sent'] || 0, description: 'All DHCPv4 responses sent' },
    { name: 'Offer', value: statistics['pkt4-offer-sent'] || 0, description: 'DHCPOFFER messages' },
    { name: 'ACK', value: statistics['pkt4-ack-sent'] || 0, description: 'DHCPACK messages' },
    { name: 'NAK', value: statistics['pkt4-nak-sent'] || 0, description: 'DHCPNAK messages' }
  ] : []

  // Extract subnet statistics
  const subnetStats = statistics ? Object.keys(statistics)
    .filter(key => key.includes('subnet[') && key.includes('].total-addresses'))
    .map(key => {
      const subnetMatch = key.match(/subnet\[(\d+)\]/)
      const subnetId = subnetMatch ? subnetMatch[1] : 'unknown'
      const totalKey = `subnet[${subnetId}].total-addresses`
      const assignedKey = `subnet[${subnetId}].assigned-addresses`
      const declinedKey = `subnet[${subnetId}].declined-addresses`
      
      const total = statistics[totalKey] || 0
      const assigned = statistics[assignedKey] || 0
      const declined = statistics[declinedKey] || 0
      
      return {
        id: subnetId,
        total,
        assigned,
        declined,
        available: total - assigned - declined,
        utilization: calculateUtilization(total, assigned)
      }
    }) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading statistics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">DHCP Statistics Overview</h2>
          <p className="text-sm text-gray-600">
            Real-time DHCP server performance and utilization metrics
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={refreshStatistics} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {statistics && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(statistics['pkt4-received'] || 0)}
                </div>
                <div className="text-sm text-gray-600">Packets Received</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(statistics['pkt4-sent'] || 0)}
                </div>
                <div className="text-sm text-gray-600">Responses Sent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {formatNumber((statistics['pkt4-parse-failed'] || 0) + (statistics['pkt4-receive-drop'] || 0))}
                </div>
                <div className="text-sm text-gray-600">Errors/Drops</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {subnetStats.reduce((sum, subnet) => sum + subnet.assigned, 0)}
                </div>
                <div className="text-sm text-gray-600">Active Leases</div>
              </CardContent>
            </Card>
          </div>

          {/* Packet Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <h3 className="font-medium">Received Packets</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Type</Th>
                      <Th>Count</Th>
                      <Th>Description</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {packetStats.map((stat, i) => (
                      <Tr key={i}>
                        <Td className="font-medium">{stat.name}</Td>
                        <Td>{formatNumber(stat.value)}</Td>
                        <Td className="text-sm text-gray-600">{stat.description}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-medium">Response Packets</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Type</Th>
                      <Th>Count</Th>
                      <Th>Description</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {responseStats.map((stat, i) => (
                      <Tr key={i}>
                        <Td className="font-medium">{stat.name}</Td>
                        <Td>{formatNumber(stat.value)}</Td>
                        <Td className="text-sm text-gray-600">{stat.description}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Subnet Utilization */}
          {subnetStats.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-medium">Subnet Utilization</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Subnet ID</Th>
                      <Th>Total Addresses</Th>
                      <Th>Assigned</Th>
                      <Th>Available</Th>
                      <Th>Declined</Th>
                      <Th>Utilization</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {subnetStats.map((subnet, i) => (
                      <Tr key={i}>
                        <Td className="font-medium">{subnet.id}</Td>
                        <Td>{formatNumber(subnet.total)}</Td>
                        <Td>{formatNumber(subnet.assigned)}</Td>
                        <Td>{formatNumber(subnet.available)}</Td>
                        <Td>{formatNumber(subnet.declined)}</Td>
                        <Td>
                          <div className="flex items-center space-x-2">
                            <div className={`font-medium ${getUtilizationColor(subnet.utilization)}`}>
                              {subnet.utilization}%
                            </div>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  subnet.utilization >= 90 ? 'bg-red-500' :
                                  subnet.utilization >= 75 ? 'bg-yellow-500' :
                                  subnet.utilization >= 50 ? 'bg-blue-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(subnet.utilization, 100)}%` }}
                              />
                            </div>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!statistics && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              <div className="text-lg mb-2">No Statistics Available</div>
              <div className="text-sm">Statistics may not be enabled or the server may not be running</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Statistics Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Packet Counters:</strong> Track DHCP message types and processing results</div>
          <div>• <strong>Utilization:</strong> Monitor address pool usage to plan capacity</div>
          <div>• <strong>Errors:</strong> Parse failures and drops indicate network or configuration issues</div>
          <div>• <strong>Performance:</strong> High request/response ratios indicate healthy operation</div>
          <div>• <strong>Monitoring:</strong> Set alerts for high utilization (&gt;80%) and error rates</div>
        </div>
      </div>
    </div>
  )
}
