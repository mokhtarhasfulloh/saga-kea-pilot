import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface SubnetStatistics {
  id: string
  'total-addresses': number
  'assigned-addresses': number
  'declined-addresses': number
  'reclaimed-declined-addresses': number
  'reclaimed-leases': number
  'cumulative-assigned-addresses': number
}

export default function SubnetStatsTab() {
  const [subnetStats, setSubnetStats] = useState<SubnetStatistics[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  async function loadSubnetStatistics() {
    setLoading(true)
    setError('')
    try {
      const result = await caCall('statistic-get-all', 'dhcp4')
      if (result.result === 0 && result.arguments) {
        const stats = result.arguments
        
        // Extract subnet statistics
        const subnetData: SubnetStatistics[] = []
        const subnetIds = new Set<string>()
        
        // Find all subnet IDs from the statistics keys
        Object.keys(stats).forEach(key => {
          const match = key.match(/subnet\[(\d+)\]\./)
          if (match) {
            subnetIds.add(match[1])
          }
        })
        
        // Build statistics for each subnet
        subnetIds.forEach(id => {
          const subnetStat: SubnetStatistics = {
            id,
            'total-addresses': stats[`subnet[${id}].total-addresses`] || 0,
            'assigned-addresses': stats[`subnet[${id}].assigned-addresses`] || 0,
            'declined-addresses': stats[`subnet[${id}].declined-addresses`] || 0,
            'reclaimed-declined-addresses': stats[`subnet[${id}].reclaimed-declined-addresses`] || 0,
            'reclaimed-leases': stats[`subnet[${id}].reclaimed-leases`] || 0,
            'cumulative-assigned-addresses': stats[`subnet[${id}].cumulative-assigned-addresses`] || 0
          }
          subnetData.push(subnetStat)
        })
        
        setSubnetStats(subnetData.sort((a, b) => parseInt(a.id) - parseInt(b.id)))
        setLastUpdate(new Date())
      } else {
        setError('Failed to retrieve subnet statistics')
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatistics() {
    setRefreshing(true)
    await loadSubnetStatistics()
    setRefreshing(false)
  }

  useEffect(() => {
    loadSubnetStatistics()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSubnetStatistics, 30000)
    return () => clearInterval(interval)
  }, [])

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

  function getUtilizationBgColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  function formatNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading subnet statistics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Subnet Statistics</h2>
          <p className="text-sm text-muted-foreground">
            Per-subnet address utilization and lease statistics
          </p>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={refreshStatistics} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {subnetStats.length > 0 ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {subnetStats.length}
                </div>
                <div className="text-sm text-gray-600">Active Subnets</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(subnetStats.reduce((sum, s) => sum + s['total-addresses'], 0))}
                </div>
                <div className="text-sm text-gray-600">Total Addresses</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {formatNumber(subnetStats.reduce((sum, s) => sum + s['assigned-addresses'], 0))}
                </div>
                <div className="text-sm text-gray-600">Assigned Addresses</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {formatNumber(subnetStats.reduce((sum, s) => sum + s['declined-addresses'], 0))}
                </div>
                <div className="text-sm text-gray-600">Declined Addresses</div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Subnet Table */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Subnet Details</h3>
            </CardHeader>
            <CardContent>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Subnet ID</Th>
                    <Th>Total</Th>
                    <Th>Assigned</Th>
                    <Th>Available</Th>
                    <Th>Declined</Th>
                    <Th>Utilization</Th>
                    <Th>Cumulative</Th>
                    <Th>Reclaimed</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {subnetStats.map((subnet) => {
                    const utilization = calculateUtilization(subnet['total-addresses'], subnet['assigned-addresses'])
                    const available = subnet['total-addresses'] - subnet['assigned-addresses'] - subnet['declined-addresses']
                    
                    return (
                      <Tr key={subnet.id}>
                        <Td className="font-medium">{subnet.id}</Td>
                        <Td>{formatNumber(subnet['total-addresses'])}</Td>
                        <Td>{formatNumber(subnet['assigned-addresses'])}</Td>
                        <Td>{formatNumber(available)}</Td>
                        <Td>
                          {subnet['declined-addresses'] > 0 ? (
                            <span className="text-red-600">{formatNumber(subnet['declined-addresses'])}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex items-center space-x-2">
                            <div className={`font-medium ${getUtilizationColor(utilization)}`}>
                              {utilization}%
                            </div>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${getUtilizationBgColor(utilization)}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                          </div>
                        </Td>
                        <Td className="text-sm text-gray-600">
                          {formatNumber(subnet['cumulative-assigned-addresses'])}
                        </Td>
                        <Td className="text-sm text-gray-600">
                          {formatNumber(subnet['reclaimed-leases'] + subnet['reclaimed-declined-addresses'])}
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </CardContent>
          </Card>

          {/* Utilization Overview */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Utilization Overview</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Low (0-49%)', color: 'bg-green-500', count: subnetStats.filter(s => calculateUtilization(s['total-addresses'], s['assigned-addresses']) < 50).length },
                  { label: 'Medium (50-74%)', color: 'bg-blue-500', count: subnetStats.filter(s => { const u = calculateUtilization(s['total-addresses'], s['assigned-addresses']); return u >= 50 && u < 75; }).length },
                  { label: 'High (75-89%)', color: 'bg-yellow-500', count: subnetStats.filter(s => { const u = calculateUtilization(s['total-addresses'], s['assigned-addresses']); return u >= 75 && u < 90; }).length },
                  { label: 'Critical (90%+)', color: 'bg-red-500', count: subnetStats.filter(s => calculateUtilization(s['total-addresses'], s['assigned-addresses']) >= 90).length }
                ].map((category, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-8 h-8 ${category.color} rounded-full mx-auto mb-2`} />
                    <div className="text-lg font-bold">{category.count}</div>
                    <div className="text-sm text-gray-600">{category.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              <div className="text-lg mb-2">No Subnet Statistics Available</div>
              <div className="text-sm">Statistics may not be enabled or no subnets are configured</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Subnet Statistics Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Utilization:</strong> Percentage of addresses currently assigned to clients</div>
          <div>• <strong>Declined:</strong> Addresses declined by clients (usually due to conflicts)</div>
          <div>• <strong>Cumulative:</strong> Total addresses assigned since server start</div>
          <div>• <strong>Reclaimed:</strong> Expired leases and declined addresses recovered</div>
          <div>• <strong>Monitoring:</strong> Watch for high utilization (&gt;80%) to plan capacity</div>
        </div>
      </div>
    </div>
  )
}
