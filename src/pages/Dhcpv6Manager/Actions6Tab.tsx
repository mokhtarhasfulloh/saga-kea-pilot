import { useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

export default function Actions6Tab() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Config management
  const [configJson, setConfigJson] = useState('')
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  
  // Statistics
  const [statistics, setStatistics] = useState<any>({})
  const [showStatistics, setShowStatistics] = useState(false)

  async function handleAction(action: string, args?: any) {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await Kea.actionDhcp6(action, args || {})
      
      if (result.result === 0) {
        setSuccess(`${action} completed successfully: ${result.text || 'OK'}`)
        
        // Handle specific action responses
        if (action === 'config-get') {
          setConfigJson(JSON.stringify(result.arguments?.Dhcp6 || result.arguments, null, 2))
          setShowConfigEditor(true)
        } else if (action === 'statistic-get-all') {
          setStatistics(result.arguments || {})
          setShowStatistics(true)
        }
      } else {
        setError(`${action} failed: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function testConfig() {
    if (!configJson.trim()) {
      setError('No configuration to test')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const config = JSON.parse(configJson)
      const result = await Kea.action('config-test', { Dhcp6: config })
      
      if (result.result === 0) {
        setSuccess('Configuration test passed successfully')
      } else {
        setError(`Configuration test failed: ${result.text}`)
      }
    } catch (e: any) {
      setError(`Invalid JSON or test failed: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function applyConfig() {
    if (!configJson.trim()) {
      setError('No configuration to apply')
      return
    }

    if (!confirm('Apply this configuration? This will replace the current DHCPv6 configuration.')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const config = JSON.parse(configJson)
      
      // Test first
      const testResult = await Kea.action('config-test', { Dhcp6: config })
      if (testResult.result !== 0) {
        throw new Error(`Configuration test failed: ${testResult.text}`)
      }
      
      // Apply
      const setResult = await Kea.action('config-set', { Dhcp6: config })
      if (setResult.result !== 0) {
        throw new Error(`Configuration set failed: ${setResult.text}`)
      }
      
      // Write to file
      await Kea.action('config-write')
      
      setSuccess('Configuration applied and saved successfully')
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function formatStatValue(value: any): string {
    if (Array.isArray(value)) {
      // Kea statistics are often arrays with [value, timestamp] pairs
      if (value.length >= 2 && typeof value[0] === 'number') {
        return value[0].toLocaleString()
      }
      return JSON.stringify(value)
    }
    if (typeof value === 'number') {
      return value.toLocaleString()
    }
    return String(value)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">DHCPv6 Server Actions</h2>
        <p className="text-sm text-gray-600">
          Perform administrative actions on the DHCPv6 server
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Server Control */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Server Control</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => handleAction('config-reload')}
              disabled={loading}
              variant="outline"
            >
              Reload Config
            </Button>
            <Button
              onClick={() => handleAction('config-write')}
              disabled={loading}
              variant="outline"
            >
              Save Config
            </Button>
            <Button
              onClick={() => handleAction('shutdown')}
              disabled={loading}
              variant="destructive"
            >
              Shutdown Server
            </Button>
            <Button
              onClick={() => handleAction('version-get')}
              disabled={loading}
              variant="outline"
            >
              Get Version
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Management */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configuration Management</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => handleAction('config-get')}
              disabled={loading}
              variant="outline"
            >
              Get Current Config
            </Button>
            <Button
              onClick={() => handleAction('config-hash-get')}
              disabled={loading}
              variant="outline"
            >
              Get Config Hash
            </Button>
          </div>

          {showConfigEditor && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium">Configuration JSON</label>
                <div className="flex gap-2">
                  <Button
                    onClick={testConfig}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                  >
                    Test Config
                  </Button>
                  <Button
                    onClick={applyConfig}
                    disabled={loading}
                    size="sm"
                  >
                    Apply Config
                  </Button>
                </div>
              </div>
              <textarea
                className="w-full h-64 px-3 py-2 border rounded font-mono text-xs"
                value={configJson}
                onChange={e => setConfigJson(e.target.value)}
                placeholder="DHCPv6 configuration JSON..."
                disabled={loading}
              />
              <div className="text-xs text-gray-500">
                Edit the configuration above and use "Test Config" before applying changes
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Server Statistics</h3>
            <Button
              onClick={() => handleAction('statistic-get-all')}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              Get All Statistics
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showStatistics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Packet Statistics */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Packet Statistics</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Received:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-received'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-sent'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Solicit:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-solicit-received'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Advertise:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-advertise-sent'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Request:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-request-received'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reply:</span>
                      <span className="font-mono">{formatStatValue(statistics['pkt6-reply-sent'])}</span>
                    </div>
                  </div>
                </div>

                {/* Address Statistics */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Address Statistics</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Assigned:</span>
                      <span className="font-mono">{formatStatValue(statistics['cumulative-assigned-addresses'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Declined:</span>
                      <span className="font-mono">{formatStatValue(statistics['declined-addresses'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reclaimed:</span>
                      <span className="font-mono">{formatStatValue(statistics['reclaimed-leases'])}</span>
                    </div>
                  </div>
                </div>

                {/* Prefix Delegation Statistics */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Prefix Delegation</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>PD Assigned:</span>
                      <span className="font-mono">{formatStatValue(statistics['cumulative-assigned-pds'])}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PD Reclaimed:</span>
                      <span className="font-mono">{formatStatValue(statistics['reclaimed-declined-addresses'])}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Statistics */}
              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">Raw Statistics Data</summary>
                <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded mt-2 overflow-auto">
                  {JSON.stringify(statistics, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">Click "Get All Statistics" to view server statistics</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lease Management */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Lease Management</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleAction('leases-reclaim', { remove: true })}
              disabled={loading}
              variant="outline"
            >
              Reclaim Leases
            </Button>
            <Button
              onClick={() => handleAction('lease6-get-all')}
              disabled={loading}
              variant="outline"
            >
              Get All Leases
            </Button>
            <Button
              onClick={() => handleAction('lease6-get-page', { from: '0', size: 100 })}
              disabled={loading}
              variant="outline"
            >
              Get Lease Page
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Use lease reclamation to clean up expired leases and free resources
          </div>
        </CardContent>
      </Card>

      {/* Network Commands */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Network Commands</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleAction('subnet6-list')}
              disabled={loading}
              variant="outline"
            >
              List Subnets
            </Button>
            <Button
              onClick={() => handleAction('network6-list')}
              disabled={loading}
              variant="outline"
            >
              List Networks
            </Button>
            <Button
              onClick={() => handleAction('class-list')}
              disabled={loading}
              variant="outline"
            >
              List Classes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">DHCPv6 Server Status</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• Use "Get Version" to check the Kea DHCPv6 server version and build info</div>
          <div>• "Reload Config" applies configuration changes without restarting the server</div>
          <div>• "Save Config" writes the current configuration to the config file</div>
          <div>• Statistics show packet counts, address assignments, and prefix delegations</div>
          <div>• Lease reclamation should be run periodically to clean up expired leases</div>
        </div>
      </div>
    </div>
  )
}
