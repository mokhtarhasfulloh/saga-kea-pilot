import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'

interface ZoneTransferConfig {
  zoneName: string
  transferType: 'AXFR' | 'IXFR'
  masterServer: string
  allowedSlaves: string[]
  tsigKey?: string
  notifyEnabled: boolean
  autoTransfer: boolean
}

interface TransferStatus {
  id: string
  zoneName: string
  transferType: 'AXFR' | 'IXFR'
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  startTime: string
  endTime?: string
  recordsTransferred?: number
  errorMessage?: string
  sourceServer: string
  targetServer: string
}

interface TransferLog {
  timestamp: string
  zoneName: string
  transferType: 'AXFR' | 'IXFR'
  status: 'success' | 'failure'
  recordsTransferred: number
  duration: number
  sourceServer: string
  message?: string
}

export default function ZoneTransferTab() {
  const [zones, setZones] = useState<string[]>([])
  const [transferConfigs, setTransferConfigs] = useState<ZoneTransferConfig[]>([])
  const [activeTransfers, setActiveTransfers] = useState<TransferStatus[]>([])
  const [transferLogs, setTransferLogs] = useState<TransferLog[]>([])
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ZoneTransferConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const toast = useToast()

  const [configForm, setConfigForm] = useState<ZoneTransferConfig>({
    zoneName: '',
    transferType: 'AXFR',
    masterServer: '',
    allowedSlaves: [],
    tsigKey: '',
    notifyEnabled: true,
    autoTransfer: false
  })

  const loadZoneTransferData = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Load available zones
      const zonesResponse = await DnsApi.getZones()
      setZones(zonesResponse.zones.map(z => z.name))
      
      // Load transfer configurations (would be from API)
      // For now, using mock data
      const mockConfigs: ZoneTransferConfig[] = [
        {
          zoneName: 'example.com',
          transferType: 'AXFR',
          masterServer: '192.168.1.10',
          allowedSlaves: ['192.168.1.11', '192.168.1.12'],
          tsigKey: 'transfer-key',
          notifyEnabled: true,
          autoTransfer: true
        }
      ]
      setTransferConfigs(mockConfigs)
      
      // Load active transfers (would be from API)
      const mockActiveTransfers: TransferStatus[] = []
      setActiveTransfers(mockActiveTransfers)
      
      // Load transfer logs (would be from API)
      const mockLogs: TransferLog[] = [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          zoneName: 'example.com',
          transferType: 'AXFR',
          status: 'success',
          recordsTransferred: 25,
          duration: 1200,
          sourceServer: '192.168.1.10'
        },
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          zoneName: 'test.local',
          transferType: 'IXFR',
          status: 'failure',
          recordsTransferred: 0,
          duration: 5000,
          sourceServer: '192.168.1.10',
          message: 'Connection timeout'
        }
      ]
      setTransferLogs(mockLogs)
      
    } catch (err: any) {
      setError(err.message || 'Failed to load zone transfer data')
    } finally {
      setLoading(false)
    }
  }

  const initiateTransfer = async (zoneName: string, transferType: 'AXFR' | 'IXFR', masterServer: string) => {
    try {
      // This would call the API to initiate a zone transfer
      const transferId = `transfer-${Date.now()}`
      
      const newTransfer: TransferStatus = {
        id: transferId,
        zoneName,
        transferType,
        status: 'pending',
        startTime: new Date().toISOString(),
        sourceServer: masterServer,
        targetServer: '127.0.0.1'
      }
      
      setActiveTransfers(prev => [...prev, newTransfer])
      toast.success('Transfer Initiated', `${transferType} transfer for ${zoneName} has been started`)
      
      // Simulate transfer progress
      setTimeout(() => {
        setActiveTransfers(prev => prev.map(t => 
          t.id === transferId 
            ? { ...t, status: 'in-progress' as const }
            : t
        ))
      }, 1000)
      
      setTimeout(() => {
        setActiveTransfers(prev => prev.filter(t => t.id !== transferId))
        
        const logEntry: TransferLog = {
          timestamp: new Date().toISOString(),
          zoneName,
          transferType,
          status: 'success',
          recordsTransferred: Math.floor(Math.random() * 50) + 10,
          duration: Math.floor(Math.random() * 5000) + 1000,
          sourceServer: masterServer
        }
        
        setTransferLogs(prev => [logEntry, ...prev.slice(0, 49)])
        toast.success('Transfer Completed', `${transferType} transfer for ${zoneName} completed successfully`)
      }, 5000)
      
    } catch (error: any) {
      toast.error('Transfer Failed', error.message || 'Failed to initiate zone transfer')
    }
  }

  const saveTransferConfig = async () => {
    try {
      if (!configForm.zoneName || !configForm.masterServer) {
        toast.error('Validation Error', 'Zone name and master server are required')
        return
      }
      
      // This would save to API
      if (editingConfig) {
        setTransferConfigs(prev => prev.map(config => 
          config.zoneName === editingConfig.zoneName ? configForm : config
        ))
        toast.success('Configuration Updated', `Transfer configuration for ${configForm.zoneName} has been updated`)
      } else {
        setTransferConfigs(prev => [...prev, configForm])
        toast.success('Configuration Saved', `Transfer configuration for ${configForm.zoneName} has been saved`)
      }
      
      setShowConfigForm(false)
      setEditingConfig(null)
      setConfigForm({
        zoneName: '',
        transferType: 'AXFR',
        masterServer: '',
        allowedSlaves: [],
        tsigKey: '',
        notifyEnabled: true,
        autoTransfer: false
      })
      
    } catch (error: any) {
      toast.error('Save Failed', error.message || 'Failed to save transfer configuration')
    }
  }

  const editConfig = (config: ZoneTransferConfig) => {
    setEditingConfig(config)
    setConfigForm({ ...config })
    setShowConfigForm(true)
  }

  const deleteConfig = async (zoneName: string) => {
    if (!confirm(`Delete transfer configuration for ${zoneName}?`)) return
    
    try {
      setTransferConfigs(prev => prev.filter(config => config.zoneName !== zoneName))
      toast.success('Configuration Deleted', `Transfer configuration for ${zoneName} has been deleted`)
    } catch (error: any) {
      toast.error('Delete Failed', error.message || 'Failed to delete transfer configuration')
    }
  }

  const addSlaveServer = () => {
    const server = prompt('Enter slave server IP address:')
    if (server && server.trim()) {
      setConfigForm(prev => ({
        ...prev,
        allowedSlaves: [...prev.allowedSlaves, server.trim()]
      }))
    }
  }

  const removeSlaveServer = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      allowedSlaves: prev.allowedSlaves.filter((_, i) => i !== index)
    }))
  }

  useEffect(() => {
    loadZoneTransferData()
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">Loading zone transfer data...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="mb-4">Failed to load zone transfer data: {error}</p>
          <Button onClick={loadZoneTransferData} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Zone Transfer Management</h3>
        <div className="flex gap-2">
          <Button onClick={loadZoneTransferData} variant="outline" size="sm">
            Refresh
          </Button>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button onClick={() => setShowConfigForm(true)} size="sm">
              Add Configuration
            </Button>
          </RoleGuard>
        </div>
      </div>

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-4">Active Transfers</h4>
          <div className="space-y-3">
            {activeTransfers.map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center space-x-4">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <div>
                    <div className="font-medium">{transfer.zoneName}</div>
                    <div className="text-sm text-gray-600">
                      {transfer.transferType} from {transfer.sourceServer}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-blue-600 font-medium">
                  {transfer.status}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transfer Configurations */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Transfer Configurations</h4>
        
        {transferConfigs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No transfer configurations found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Master Server</th>
                  <th className="text-left p-3 font-medium">Allowed Slaves</th>
                  <th className="text-left p-3 font-medium">TSIG Key</th>
                  <th className="text-left p-3 font-medium">Auto Transfer</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transferConfigs.map((config) => (
                  <tr key={config.zoneName} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm">{config.zoneName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        config.transferType === 'AXFR' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {config.transferType}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-sm">{config.masterServer}</td>
                    <td className="p-3 text-sm">
                      {config.allowedSlaves.length > 0 ? (
                        <div className="space-y-1">
                          {config.allowedSlaves.slice(0, 2).map((slave, index) => (
                            <div key={index} className="font-mono text-xs">{slave}</div>
                          ))}
                          {config.allowedSlaves.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{config.allowedSlaves.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">None</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {config.tsigKey ? (
                        <span className="text-green-600">✓ Configured</span>
                      ) : (
                        <span className="text-gray-500">None</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        config.autoTransfer 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.autoTransfer ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => initiateTransfer(config.zoneName, config.transferType, config.masterServer)}
                        >
                          Transfer
                        </Button>
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editConfig(config)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConfig(config.zoneName)}
                            className="text-red-600"
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
        )}
      </Card>

      {/* Transfer Logs */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">Transfer History</h4>
        
        {transferLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No transfer history found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Records</th>
                  <th className="text-left p-3 font-medium">Duration</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {transferLogs.slice(0, 20).map((log, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-sm">{log.zoneName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.transferType === 'AXFR' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {log.transferType}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{log.recordsTransferred}</td>
                    <td className="p-3 text-sm">{(log.duration / 1000).toFixed(1)}s</td>
                    <td className="p-3 font-mono text-sm">{log.sourceServer}</td>
                    <td className="p-3 text-sm">
                      {log.message || (log.status === 'success' ? 'Transfer completed successfully' : 'Transfer failed')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Configuration Form Modal */}
      {showConfigForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                {editingConfig ? 'Edit Transfer Configuration' : 'Add Transfer Configuration'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowConfigForm(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              {/* Zone Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Zone Name *</label>
                <select
                  value={configForm.zoneName}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, zoneName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!!editingConfig}
                >
                  <option value="">Select a zone</option>
                  {zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              {/* Transfer Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Transfer Type</label>
                <select
                  value={configForm.transferType}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, transferType: e.target.value as 'AXFR' | 'IXFR' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AXFR">AXFR (Full Transfer)</option>
                  <option value="IXFR">IXFR (Incremental Transfer)</option>
                </select>
              </div>

              {/* Master Server */}
              <div>
                <label className="block text-sm font-medium mb-1">Master Server *</label>
                <input
                  type="text"
                  value={configForm.masterServer}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, masterServer: e.target.value }))}
                  placeholder="192.168.1.10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Allowed Slaves */}
              <div>
                <label className="block text-sm font-medium mb-1">Allowed Slave Servers</label>
                <div className="space-y-2">
                  {configForm.allowedSlaves.map((slave, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={slave}
                        onChange={(e) => {
                          const newSlaves = [...configForm.allowedSlaves]
                          newSlaves[index] = e.target.value
                          setConfigForm(prev => ({ ...prev, allowedSlaves: newSlaves }))
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSlaveServer(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSlaveServer}>
                    Add Slave Server
                  </Button>
                </div>
              </div>

              {/* TSIG Key */}
              <div>
                <label className="block text-sm font-medium mb-1">TSIG Key (Optional)</label>
                <input
                  type="text"
                  value={configForm.tsigKey}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, tsigKey: e.target.value }))}
                  placeholder="transfer-key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={configForm.notifyEnabled}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, notifyEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable DNS NOTIFY</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={configForm.autoTransfer}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, autoTransfer: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable automatic transfers</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowConfigForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveTransferConfig}
                  disabled={!configForm.zoneName || !configForm.masterServer}
                  className="flex-1"
                >
                  {editingConfig ? 'Update Configuration' : 'Save Configuration'}
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
