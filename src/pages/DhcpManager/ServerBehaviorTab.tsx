import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import { Alert } from '../../components/ui/alert'
import Button from '../../components/ui/button'
import ServerBehaviorControls from '../../components/dhcp/ServerBehaviorControls'

interface ServerBehaviorConfig {
  'echo-client-id'?: boolean
  'match-client-id'?: boolean
  authoritative?: boolean
  'lenient-option-parsing'?: boolean
  'valid-lifetime'?: number
  'renew-timer'?: number
  'rebind-timer'?: number
  'min-valid-lifetime'?: number
  'max-valid-lifetime'?: number
  'decline-probation-period'?: number
  'dhcp4o6-port'?: number
  'server-hostname'?: string
  'boot-file-name'?: string
  'next-server'?: string
}

export default function ServerBehaviorTab() {
  const [config, setConfig] = useState<ServerBehaviorConfig>({})
  const [originalConfig, setOriginalConfig] = useState<ServerBehaviorConfig>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await Kea.configGet()
      const dhcp4 = response?.Dhcp4 || response
      
      const serverConfig: ServerBehaviorConfig = {
        'echo-client-id': dhcp4['echo-client-id'],
        'match-client-id': dhcp4['match-client-id'],
        authoritative: dhcp4.authoritative,
        'lenient-option-parsing': dhcp4['lenient-option-parsing'],
        'valid-lifetime': dhcp4['valid-lifetime'],
        'renew-timer': dhcp4['renew-timer'],
        'rebind-timer': dhcp4['rebind-timer'],
        'min-valid-lifetime': dhcp4['min-valid-lifetime'],
        'max-valid-lifetime': dhcp4['max-valid-lifetime'],
        'decline-probation-period': dhcp4['decline-probation-period'],
        'dhcp4o6-port': dhcp4['dhcp4o6-port'],
        'server-hostname': dhcp4['server-hostname'],
        'boot-file-name': dhcp4['boot-file-name'],
        'next-server': dhcp4['next-server']
      }
      
      setConfig(serverConfig)
      setOriginalConfig(serverConfig)
      setHasChanges(false)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig))
  }, [config, originalConfig])

  async function saveConfig() {
    setSaving(true)
    setError('')
    try {
      const currentConfig = await Kea.configGet()
      const dhcp4 = currentConfig?.Dhcp4 || currentConfig
      
      // Merge server behavior settings with existing config
      const updatedConfig = {
        ...dhcp4,
        ...Object.fromEntries(
          Object.entries(config).filter(([_, value]) => value !== undefined)
        )
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')
      
      setOriginalConfig(config)
      setHasChanges(false)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function resetConfig() {
    if (!confirm('Reset all changes to last saved configuration?')) return
    setConfig(originalConfig)
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading server configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Server Behavior</h2>
          <p className="text-sm text-gray-600">
            Configure DHCP server compatibility settings, timers, and behavior
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              onClick={resetConfig}
              disabled={saving}
            >
              Reset Changes
            </Button>
          )}
          <Button
            onClick={saveConfig}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {hasChanges && (
        <Alert variant="warn">
          You have unsaved changes. Click "Save Configuration" to apply them.
        </Alert>
      )}

      <ServerBehaviorControls
        config={config}
        onChange={setConfig}
        disabled={saving}
      />

      {/* Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Best Practices</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <div>
            <strong>Echo Client ID:</strong> Keep enabled unless you have legacy clients that malfunction 
            when receiving their client identifier back.
          </div>
          <div>
            <strong>Match Client ID:</strong> Disable for networks with clients that change their 
            client identifier but keep the same MAC address.
          </div>
          <div>
            <strong>Authoritative:</strong> Enable only if this is the sole DHCP server on the network. 
            Disable in environments with multiple DHCP servers.
          </div>
          <div>
            <strong>Timer Ratios:</strong> Standard ratios are T1=50% and T2=87.5% of valid lifetime. 
            Adjust based on network stability and client behavior.
          </div>
        </div>
      </div>

      {/* Compatibility Notes */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="font-medium text-yellow-800 mb-2">Compatibility Notes</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <div>• Some older Windows clients may require echo-client-id to be disabled</div>
          <div>• PXE clients often need specific boot options configured globally or per-class</div>
          <div>• Very short lease times (&lt;300s) may cause excessive DHCP traffic</div>
          <div>• Lenient option parsing should only be enabled for problematic clients</div>
          <div>• DHCPv4-over-DHCPv6 is for dual-stack transition scenarios</div>
        </div>
      </div>
    </div>
  )
}
