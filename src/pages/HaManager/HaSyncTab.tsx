import { useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

interface SyncResult {
  result: number
  text: string
  'leases-synced'?: number
  'sync-time'?: number
}

export default function HaSyncTab() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])

  async function performHaSync() {
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const result = await caCall('ha-sync', 'dhcp4')
      
      if (result.result === 0) {
        setSuccess(`HA sync completed successfully. ${result.text || ''}`)
        setSyncResults(prev => [{
          result: result.result,
          text: result.text || 'Sync completed',
          'leases-synced': result.arguments?.['leases-synced'],
          'sync-time': Date.now()
        }, ...prev.slice(0, 9)]) // Keep last 10 results
      } else {
        setError(`HA sync failed: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(`Failed to perform HA sync: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function performHaReset() {
    if (!confirm('Reset HA state? This will reset the HA state machine and may cause service interruption.')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const result = await caCall('ha-reset', 'dhcp4')
      
      if (result.result === 0) {
        setSuccess(`HA reset completed successfully. ${result.text || ''}`)
        setSyncResults(prev => [{
          result: result.result,
          text: `RESET: ${result.text || 'Reset completed'}`,
          'sync-time': Date.now()
        }, ...prev.slice(0, 9)])
      } else {
        setError(`HA reset failed: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(`Failed to perform HA reset: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function performHaMaintenanceStart() {
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const result = await caCall('ha-maintenance-start', 'dhcp4')
      
      if (result.result === 0) {
        setSuccess('HA maintenance mode started. Partner will handle all traffic.')
        setSyncResults(prev => [{
          result: result.result,
          text: 'MAINTENANCE: Started maintenance mode',
          'sync-time': Date.now()
        }, ...prev.slice(0, 9)])
      } else {
        setError(`Failed to start maintenance mode: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(`Failed to start maintenance mode: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function performHaMaintenanceStop() {
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const result = await caCall('ha-maintenance-cancel', 'dhcp4')
      
      if (result.result === 0) {
        setSuccess('HA maintenance mode stopped. Normal operation resumed.')
        setSyncResults(prev => [{
          result: result.result,
          text: 'MAINTENANCE: Stopped maintenance mode',
          'sync-time': Date.now()
        }, ...prev.slice(0, 9)])
      } else {
        setError(`Failed to stop maintenance mode: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(`Failed to stop maintenance mode: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">HA Synchronization & Control</h2>
        <p className="text-sm text-gray-600">
          Manage HA synchronization, maintenance mode, and state reset operations
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* HA Control Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-medium">Synchronization</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Manually trigger lease database synchronization between HA peers.
            </p>
            <Button 
              onClick={performHaSync} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Syncing...' : 'Sync Leases'}
            </Button>
            <div className="text-xs text-gray-500">
              Forces immediate synchronization of lease databases between HA partners.
              Use when databases are out of sync.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">State Reset</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Reset the HA state machine to recover from error conditions.
            </p>
            <Button 
              onClick={performHaReset} 
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              {loading ? 'Resetting...' : 'Reset HA State'}
            </Button>
            <div className="text-xs text-gray-500">
              ⚠️ This will reset the HA state machine and may cause temporary service interruption.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Maintenance Mode</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Enter maintenance mode to perform server updates safely.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={performHaMaintenanceStart} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? 'Starting...' : 'Start Maintenance'}
              </Button>
              <Button 
                onClick={performHaMaintenanceStop} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? 'Stopping...' : 'Stop Maintenance'}
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              Maintenance mode allows safe server updates by having the partner handle all traffic.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-medium">Safety Guidelines</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <div>Always verify HA status before performing operations</div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <div>Use maintenance mode for planned server updates</div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <div>Monitor sync results and partner connectivity</div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                <div>Reset operations may cause temporary service interruption</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      {syncResults.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Recent Operations</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncResults.map((result, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      result.result === 0 ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <div className="text-sm font-medium">{result.text}</div>
                      {result['leases-synced'] !== undefined && (
                        <div className="text-xs text-gray-500">
                          {result['leases-synced']} leases synchronized
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {result['sync-time'] ? new Date(result['sync-time']).toLocaleTimeString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HA Sync Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">HA Operations Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Sync Leases:</strong> Manually synchronize lease databases between partners</div>
          <div>• <strong>Reset State:</strong> Reset HA state machine to recover from errors</div>
          <div>• <strong>Maintenance Mode:</strong> Safely take server offline for updates</div>
          <div>• <strong>Best Practice:</strong> Always check HA status before performing operations</div>
          <div>• <strong>Monitoring:</strong> Watch for communication interruptions and sync failures</div>
        </div>
      </div>
    </div>
  )
}
