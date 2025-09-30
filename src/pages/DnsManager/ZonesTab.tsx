import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { ZoneT, ZoneListResponseT, ZoneValidationT } from '../../lib/schemas/dns'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'
import ValidationOutput from '../../components/ValidationOutput'

export default function ZonesTab() {
  const [zones, setZones] = useState<ZoneT[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [validationResult, setValidationResult] = useState<ZoneValidationT | null>(null)
  const [validatingZone, setValidatingZone] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    name: '',
    type: 'master' as 'master' | 'slave' | 'forward',
    primaryNs: '',
    adminEmail: ''
  })
  const [creatingZone, setCreatingZone] = useState(false)
  const toast = useToast()

  const loadZones = async () => {
    setLoading(true)
    setError('')
    try {
      const response: ZoneListResponseT = await DnsApi.getZones()
      setZones(response.zones)
    } catch (err: any) {
      setError(err.message || 'Failed to load zones')
      console.error('Failed to load zones:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadZones()
  }, [])

  const handleReload = () => {
    loadZones()
  }

  const handleValidateZone = async (zoneName: string) => {
    setValidatingZone(zoneName)
    try {
      const result = await DnsApi.validateZone(zoneName)
      if (result.validation) {
        setValidationResult(result.validation)
        if (result.validation.valid) {
          toast.success('Zone Validation', `Zone ${zoneName} is valid`)
        } else {
          toast.error('Zone Validation Failed', `Zone ${zoneName} has validation errors`, result.validation)
        }
      }
    } catch (err: any) {
      toast.error('Validation Error', err.message || 'Failed to validate zone')
    } finally {
      setValidatingZone('')
    }
  }

  const handleReloadZone = async (zoneName: string) => {
    try {
      await DnsApi.reloadZone(zoneName)
      toast.success('Zone Reloaded', `Zone ${zoneName} has been reloaded`)
    } catch (err: any) {
      toast.error('Reload Failed', err.message || 'Failed to reload zone')
    }
  }

  const createZone = async () => {
    if (!createFormData.name.trim()) {
      toast.error('Validation Error', 'Zone name is required')
      return
    }

    setCreatingZone(true)
    try {
      const result = await DnsApi.createZone({
        name: createFormData.name.trim(),
        type: createFormData.type,
        primaryNs: createFormData.primaryNs.trim() || undefined,
        adminEmail: createFormData.adminEmail.trim() || undefined
      })

      toast.success('Zone Created', result.message || `Zone ${createFormData.name} created successfully`)
      setShowCreateForm(false)
      setCreateFormData({ name: '', type: 'master', primaryNs: '', adminEmail: '' })
      await loadZones()
    } catch (err: any) {
      toast.error('Creation Failed', err.message || 'Failed to create zone')
    } finally {
      setCreatingZone(false)
    }
  }

  const deleteZone = async (zoneName: string) => {
    if (!confirm(`Are you sure you want to delete zone "${zoneName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const result = await DnsApi.deleteZone(zoneName)
      toast.success('Zone Deleted', result.message || `Zone ${zoneName} deleted successfully`)
      await loadZones()
    } catch (err: any) {
      toast.error('Deletion Failed', err.message || 'Failed to delete zone')
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-600">Loading zones...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={handleReload} variant="outline">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">DNS Zones</h3>
        <div className="flex gap-2">
          <Button onClick={handleReload} variant="outline" size="sm">
            Refresh
          </Button>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              Add Zone
            </Button>
          </RoleGuard>
        </div>
      </div>

      {zones.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-gray-600">
            <div className="text-lg mb-2">No zones found</div>
            <div className="text-sm">Create your first DNS zone to get started</div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Zone Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Serial</th>
                  <th className="text-left p-3 font-medium">Primary NS</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone, index) => (
                  <tr key={zone.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-mono text-sm">{zone.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        zone.type === 'master' ? 'bg-green-100 text-green-800' :
                        zone.type === 'slave' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {zone.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {zone.serial || 'N/A'}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {zone.primaryNs || 'N/A'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </RoleGuard>
                        <Button variant="ghost" size="sm">
                          Records
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleValidateZone(zone.name)}
                          disabled={validatingZone === zone.name}
                        >
                          {validatingZone === zone.name ? 'Validating...' : 'Validate'}
                        </Button>
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReloadZone(zone.name)}
                          >
                            Reload
                          </Button>
                        </RoleGuard>
                        <RoleGuard requiredPermission="canDelete" hideIfNoAccess>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteZone(zone.name)}
                          >
                            Delete
                          </Button>
                        </RoleGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {validationResult && (
        <ValidationOutput
          validation={validationResult}
          title="Zone Validation Results"
        />
      )}

      {/* Create Zone Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create DNS Zone</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zone Name *</label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Zone Type</label>
                <select
                  value={createFormData.type}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, type: e.target.value as 'master' | 'slave' | 'forward' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="master">Master</option>
                  <option value="slave">Slave</option>
                  <option value="forward">Forward</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Primary Name Server</label>
                <input
                  type="text"
                  value={createFormData.primaryNs}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, primaryNs: e.target.value }))}
                  placeholder="ns1.example.com (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Admin Email</label>
                <input
                  type="email"
                  value={createFormData.adminEmail}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                  placeholder="admin@example.com (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createZone}
                  disabled={creatingZone || !createFormData.name.trim()}
                  className="flex-1"
                >
                  {creatingZone ? 'Creating...' : 'Create Zone'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
