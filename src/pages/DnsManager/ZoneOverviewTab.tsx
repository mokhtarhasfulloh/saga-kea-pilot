import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { ZoneT, ZoneListResponseT } from '../../lib/schemas/dns'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'

interface ZoneStats {
  totalZones: number
  totalRecords: number
  healthyZones: number
  warningZones: number
  errorZones: number
  lastUpdate: string
}

interface ZoneHealth {
  zoneName: string
  status: 'healthy' | 'warning' | 'error'
  recordCount: number
  lastModified: string
  issues: string[]
}

export default function ZoneOverviewTab() {
  const [zones, setZones] = useState<ZoneT[]>([])
  const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null)
  const [zoneHealth, setZoneHealth] = useState<ZoneHealth[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()

  const loadDashboardData = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Load zones
      const zonesResponse: ZoneListResponseT = await DnsApi.getZones()
      setZones(zonesResponse.zones)
      
      // Calculate statistics
      const stats: ZoneStats = {
        totalZones: zonesResponse.zones.length,
        totalRecords: 0,
        healthyZones: 0,
        warningZones: 0,
        errorZones: 0,
        lastUpdate: new Date().toISOString()
      }
      
      const healthData: ZoneHealth[] = []
      
      // Analyze each zone
      for (const zone of zonesResponse.zones) {
        try {
          const recordsResponse = await DnsApi.getRecords(zone.name)
          const recordCount = recordsResponse.records.length
          stats.totalRecords += recordCount
          
          // Determine zone health
          let status: 'healthy' | 'warning' | 'error' = 'healthy'
          const issues: string[] = []
          
          // Check for common issues
          if (recordCount === 0) {
            status = 'warning'
            issues.push('No DNS records found')
          }
          
          const hasNS = recordsResponse.records.some(r => r.type === 'NS')
          if (!hasNS) {
            status = 'error'
            issues.push('Missing NS records')
          }
          
          const hasSOA = recordsResponse.records.some(r => r.type === 'SOA')
          if (!hasSOA) {
            status = 'warning'
            issues.push('Missing SOA record')
          }
          
          // Check for duplicate records
          const recordKeys = recordsResponse.records.map(r => `${r.name}-${r.type}`)
          const duplicates = recordKeys.filter((key, index) => recordKeys.indexOf(key) !== index)
          if (duplicates.length > 0) {
            status = 'warning'
            issues.push(`Duplicate records detected: ${duplicates.length}`)
          }
          
          // Update stats
          if (status === 'healthy') stats.healthyZones++
          else if (status === 'warning') stats.warningZones++
          else stats.errorZones++
          
          healthData.push({
            zoneName: zone.name,
            status,
            recordCount,
            lastModified: zone.serial ? new Date().toISOString() : 'Unknown',
            issues
          })
          
        } catch (error) {
          // Zone has issues
          stats.errorZones++
          healthData.push({
            zoneName: zone.name,
            status: 'error',
            recordCount: 0,
            lastModified: 'Unknown',
            issues: ['Failed to load zone data']
          })
        }
      }
      
      setZoneStats(stats)
      setZoneHealth(healthData)
      
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshDashboard = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
    toast.success('Dashboard Refreshed', 'Zone overview data has been updated')
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">Loading zone overview...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="mb-4">Failed to load zone overview: {error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✗'
      default: return '?'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Zone Overview Dashboard</h3>
        <div className="flex gap-2">
          <Button 
            onClick={refreshDashboard} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button size="sm">
              Add Zone
            </Button>
          </RoleGuard>
        </div>
      </div>

      {/* Statistics Cards */}
      {zoneStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{zoneStats.totalZones}</div>
              <div className="text-sm text-gray-600">Total Zones</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{zoneStats.totalRecords}</div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{zoneStats.healthyZones}</div>
              <div className="text-sm text-gray-600">Healthy Zones</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{zoneStats.warningZones}</div>
              <div className="text-sm text-gray-600">Warning Zones</div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{zoneStats.errorZones}</div>
              <div className="text-sm text-gray-600">Error Zones</div>
            </div>
          </Card>
        </div>
      )}

      {/* Zone Health Status */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Zone Health Status</h4>
        
        {zoneHealth.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No zones configured
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Zone Name</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Records</th>
                  <th className="text-left p-3 font-medium">Last Modified</th>
                  <th className="text-left p-3 font-medium">Issues</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zoneHealth.map((zone) => (
                  <tr key={zone.zoneName} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm">{zone.zoneName}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(zone.status)}`}>
                        {getStatusIcon(zone.status)} {zone.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{zone.recordCount}</td>
                    <td className="p-3 text-sm">
                      {zone.lastModified !== 'Unknown' 
                        ? new Date(zone.lastModified).toLocaleDateString()
                        : 'Unknown'
                      }
                    </td>
                    <td className="p-3 text-sm">
                      {zone.issues.length > 0 ? (
                        <div className="space-y-1">
                          {zone.issues.map((issue, index) => (
                            <div key={index} className="text-red-600 text-xs">{issue}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-green-600 text-xs">No issues</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </RoleGuard>
                        {zone.status === 'error' && (
                          <Button variant="ghost" size="sm" className="text-blue-600">
                            Diagnose
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Quick Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <div className="text-lg mb-1">+</div>
              <div className="text-sm">Create Zone</div>
            </Button>
          </RoleGuard>
          
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-lg mb-1">📊</div>
            <div className="text-sm">View Statistics</div>
          </Button>
          
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <div className="text-lg mb-1">📥</div>
              <div className="text-sm">Import Zones</div>
            </Button>
          </RoleGuard>
          
          <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
            <div className="text-lg mb-1">🔍</div>
            <div className="text-sm">DNS Lookup</div>
          </Button>
        </div>
      </Card>

      {zoneStats && (
        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date(zoneStats.lastUpdate).toLocaleString()}
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
