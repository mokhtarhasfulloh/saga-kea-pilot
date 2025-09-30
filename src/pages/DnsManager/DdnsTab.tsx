import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'

interface TsigKey {
  name: string
  algorithm: string
  created: string
  lastUsed?: string
  usageCount: number
}

interface DdnsConfig {
  enabled: boolean
  allowedZones: string[]
  tsigKeys: TsigKey[]
  updatePolicies: Array<{
    zone: string
    policy: string
    keyName: string
  }>
  statistics: {
    totalUpdates: number
    successfulUpdates: number
    failedUpdates: number
    lastUpdate: string
  }
}

interface DdnsHistoryEntry {
  id: string
  timestamp: string
  zone: string
  name: string
  type: string
  oldValue: string
  newValue: string
  ttl: number
  source: string
  tsigKey: string
  status: 'success' | 'failed'
  message: string
}

export default function DdnsTab() {
  const [config, setConfig] = useState<DdnsConfig | null>(null)
  const [history, setHistory] = useState<DdnsHistoryEntry[]>([])
  const [showKeyGenForm, setShowKeyGenForm] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const toast = useToast()

  const [keyGenForm, setKeyGenForm] = useState({
    keyName: '',
    algorithm: 'hmac-sha256'
  })

  const [updateForm, setUpdateForm] = useState({
    zone: '',
    name: '',
    type: 'A',
    value: '',
    ttl: 300,
    tsigKey: ''
  })

  const loadDdnsData = async () => {
    setLoading(true)
    setError('')
    
    try {
      const [configResponse, historyResponse] = await Promise.all([
        DnsApi.getDdnsConfig(),
        DnsApi.getDdnsHistory(selectedZone, 50)
      ])
      
      setConfig(configResponse)
      setHistory(historyResponse.history || [])
      
    } catch (err: any) {
      setError(err.message || 'Failed to load DDNS data')
    } finally {
      setLoading(false)
    }
  }

  const generateTsigKey = async () => {
    try {
      if (!keyGenForm.keyName.trim()) {
        toast.error('Validation Error', 'Key name is required')
        return
      }
      
      const result = await DnsApi.generateTsigKey(keyGenForm.keyName, keyGenForm.algorithm)
      
      toast.success('TSIG Key Generated', `Key '${keyGenForm.keyName}' generated successfully`)
      setShowKeyGenForm(false)
      setKeyGenForm({ keyName: '', algorithm: 'hmac-sha256' })
      
      // Reload data to show new key
      await loadDdnsData()
      
    } catch (error: any) {
      toast.error('Key Generation Failed', error.message || 'Failed to generate TSIG key')
    }
  }

  const deleteTsigKey = async (keyName: string) => {
    if (!confirm(`Delete TSIG key '${keyName}'? This action cannot be undone.`)) return
    
    try {
      await DnsApi.deleteTsigKey(keyName)
      toast.success('Key Deleted', `TSIG key '${keyName}' deleted successfully`)
      await loadDdnsData()
      
    } catch (error: any) {
      toast.error('Delete Failed', error.message || 'Failed to delete TSIG key')
    }
  }

  const performDdnsUpdate = async () => {
    try {
      if (!updateForm.zone || !updateForm.name || !updateForm.value) {
        toast.error('Validation Error', 'Zone, name, and value are required')
        return
      }
      
      const result = await DnsApi.ddnsUpdate(
        updateForm.zone,
        updateForm.name,
        updateForm.type,
        updateForm.value,
        updateForm.ttl,
        updateForm.tsigKey
      )
      
      toast.success('DDNS Update Successful', result.message || 'DNS record updated successfully')
      setShowUpdateForm(false)
      setUpdateForm({
        zone: '',
        name: '',
        type: 'A',
        value: '',
        ttl: 300,
        tsigKey: ''
      })
      
      // Reload history to show new update
      await loadDdnsData()
      
    } catch (error: any) {
      toast.error('DDNS Update Failed', error.message || 'Failed to update DNS record')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  useEffect(() => {
    loadDdnsData()
  }, [selectedZone])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">Loading DDNS data...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="mb-4">Failed to load DDNS data: {error}</p>
          <Button onClick={loadDdnsData} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Dynamic DNS (DDNS) Management</h3>
        <div className="flex gap-2">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Zones</option>
            {config?.allowedZones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
          <Button onClick={loadDdnsData} variant="outline" size="sm">
            Refresh
          </Button>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button onClick={() => setShowKeyGenForm(true)} size="sm">
              Generate Key
            </Button>
            <Button onClick={() => setShowUpdateForm(true)} size="sm">
              DDNS Update
            </Button>
          </RoleGuard>
        </div>
      </div>

      {/* DDNS Configuration Overview */}
      {config && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-4">DDNS Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{config.statistics.totalUpdates}</div>
              <div className="text-sm text-gray-600">Total Updates</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{config.statistics.successfulUpdates}</div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{config.statistics.failedUpdates}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{config.tsigKeys.length}</div>
              <div className="text-sm text-gray-600">TSIG Keys</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allowed Zones */}
            <div>
              <h5 className="font-medium mb-2">Allowed Zones</h5>
              <div className="space-y-1">
                {config.allowedZones.map(zone => (
                  <div key={zone} className="px-3 py-2 bg-muted text-foreground rounded text-sm font-mono">
                    {zone}
                  </div>
                ))}
              </div>
            </div>

            {/* Update Policies */}
            <div>
              <h5 className="font-medium mb-2">Update Policies</h5>
              <div className="space-y-2">
                {config.updatePolicies.map((policy, index) => (
                  <div key={index} className="px-3 py-2 bg-muted rounded">
                    <div className="text-sm font-mono text-foreground">{policy.zone}</div>
                    <div className="text-xs text-muted-foreground">{policy.policy}</div>
                    <div className="text-xs text-primary">Key: {policy.keyName}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TSIG Keys */}
      {config && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-4">TSIG Keys</h4>
          
          {config.tsigKeys.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No TSIG keys configured
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Key Name</th>
                    <th className="text-left p-3 font-medium">Algorithm</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-left p-3 font-medium">Last Used</th>
                    <th className="text-left p-3 font-medium">Usage Count</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {config.tsigKeys.map((key) => (
                    <tr key={key.name} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-sm">{key.name}</td>
                      <td className="p-3 text-sm">{key.algorithm}</td>
                      <td className="p-3 text-sm">
                        {new Date(key.created).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-sm">
                        {key.lastUsed 
                          ? new Date(key.lastUsed).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="p-3 text-sm">{key.usageCount}</td>
                      <td className="p-3">
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTsigKey(key.name)}
                            className="text-red-600"
                          >
                            Delete
                          </Button>
                        </RoleGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* DDNS Update History */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Update History</h4>
        
        {history.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No DDNS updates found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Record</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Old Value</th>
                  <th className="text-left p-3 font-medium">New Value</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-sm">{entry.zone}</td>
                    <td className="p-3 font-mono text-sm">{entry.name}</td>
                    <td className="p-3 text-sm">{entry.type}</td>
                    <td className="p-3 font-mono text-sm text-gray-600">{entry.oldValue}</td>
                    <td className="p-3 font-mono text-sm">{entry.newValue}</td>
                    <td className="p-3 font-mono text-sm">{entry.source}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* TSIG Key Generation Form Modal */}
      {showKeyGenForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Generate TSIG Key</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowKeyGenForm(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Key Name *</label>
                <input
                  type="text"
                  value={keyGenForm.keyName}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, keyName: e.target.value }))}
                  placeholder="update-key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Algorithm</label>
                <select
                  value={keyGenForm.algorithm}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, algorithm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hmac-sha256">HMAC-SHA256</option>
                  <option value="hmac-sha512">HMAC-SHA512</option>
                  <option value="hmac-md5">HMAC-MD5</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowKeyGenForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={generateTsigKey}
                  disabled={!keyGenForm.keyName.trim()}
                  className="flex-1"
                >
                  Generate Key
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* DDNS Update Form Modal */}
      {showUpdateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">DDNS Update</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowUpdateForm(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zone *</label>
                <select
                  value={updateForm.zone}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, zone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a zone</option>
                  {config?.allowedZones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Record Name *</label>
                <input
                  type="text"
                  value={updateForm.name}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="host1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Record Type</label>
                <select
                  value={updateForm.type}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A">A</option>
                  <option value="AAAA">AAAA</option>
                  <option value="CNAME">CNAME</option>
                  <option value="TXT">TXT</option>
                  <option value="MX">MX</option>
                  <option value="SRV">SRV</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Value *</label>
                <input
                  type="text"
                  value={updateForm.value}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">TTL (seconds)</label>
                <input
                  type="number"
                  value={updateForm.ttl}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, ttl: parseInt(e.target.value) || 300 }))}
                  min="60"
                  max="86400"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">TSIG Key (Optional)</label>
                <select
                  value={updateForm.tsigKey}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, tsigKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No authentication</option>
                  {config?.tsigKeys.map(key => (
                    <option key={key.name} value={key.name}>{key.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowUpdateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={performDdnsUpdate}
                  disabled={!updateForm.zone || !updateForm.name || !updateForm.value}
                  className="flex-1"
                >
                  Update Record
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
