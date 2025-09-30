import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

interface HaConfig {
  'this-server-name': string
  mode: 'load-balancing' | 'hot-standby'
  'heartbeat-delay': number
  'max-response-delay': number
  'max-ack-delay': number
  'max-unacked-clients': number
  peers: Array<{
    name: string
    url: string
    role: 'primary' | 'secondary' | 'backup'
    'auto-failover': boolean
  }>
}

export default function HaConfigTab() {
  const [haConfig, setHaConfig] = useState<HaConfig | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [serverName, setServerName] = useState('')
  const [mode, setMode] = useState<'load-balancing' | 'hot-standby'>('hot-standby')
  const [heartbeatDelay, setHeartbeatDelay] = useState(10000)
  const [maxResponseDelay, setMaxResponseDelay] = useState(60000)
  const [maxAckDelay, setMaxAckDelay] = useState(10000)
  const [maxUnackedClients, setMaxUnackedClients] = useState(10)
  const [peers, setPeers] = useState<HaConfig['peers']>([])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}
      
      // Look for HA hook configuration
      const haHook = dhcp4['hooks-libraries']?.find((hook: any) => 
        hook.library.includes('libdhcp_ha.so')
      )
      
      if (haHook?.parameters) {
        setHaConfig(haHook.parameters)
        setServerName(haHook.parameters['this-server-name'] || '')
        setMode(haHook.parameters.mode || 'hot-standby')
        setHeartbeatDelay(haHook.parameters['heartbeat-delay'] || 10000)
        setMaxResponseDelay(haHook.parameters['max-response-delay'] || 60000)
        setMaxAckDelay(haHook.parameters['max-ack-delay'] || 10000)
        setMaxUnackedClients(haHook.parameters['max-unacked-clients'] || 10)
        setPeers(haHook.parameters.peers || [])
      } else {
        setHaConfig(null)
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function addPeer() {
    setPeers([...peers, {
      name: '',
      url: '',
      role: 'secondary',
      'auto-failover': true
    }])
  }

  function removePeer(index: number) {
    setPeers(peers.filter((_, i) => i !== index))
  }

  function updatePeer(index: number, field: keyof HaConfig['peers'][0], value: any) {
    const newPeers = [...peers]
    newPeers[index] = { ...newPeers[index], [field]: value }
    setPeers(newPeers)
  }

  async function saveHaConfig() {
    if (!serverName.trim()) {
      setError('Server name is required')
      return
    }

    if (peers.length === 0) {
      setError('At least one peer is required for HA')
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      const haParameters: HaConfig = {
        'this-server-name': serverName,
        mode,
        'heartbeat-delay': heartbeatDelay,
        'max-response-delay': maxResponseDelay,
        'max-ack-delay': maxAckDelay,
        'max-unacked-clients': maxUnackedClients,
        peers
      }

      // Update or add HA hook
      let hooksLibraries = [...(dhcp4['hooks-libraries'] || [])]
      const haHookIndex = hooksLibraries.findIndex((hook: any) => 
        hook.library.includes('libdhcp_ha.so')
      )

      const haHook = {
        library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_ha.so',
        parameters: haParameters
      }

      if (haHookIndex >= 0) {
        hooksLibraries[haHookIndex] = haHook
      } else {
        hooksLibraries.push(haHook)
      }

      const updatedConfig = {
        ...dhcp4,
        'hooks-libraries': hooksLibraries
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      setShowForm(false)
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function disableHa() {
    if (!confirm('Disable High Availability? This will remove HA configuration.')) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      // Remove HA hook
      const hooksLibraries = (dhcp4['hooks-libraries'] || []).filter((hook: any) => 
        !hook.library.includes('libdhcp_ha.so')
      )

      const updatedConfig = {
        ...dhcp4,
        'hooks-libraries': hooksLibraries
      }

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading HA configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">High Availability Configuration</h2>
          <p className="text-sm text-gray-600">
            Configure Kea DHCP High Availability for failover and load balancing
          </p>
        </div>
        <div className="flex gap-2">
          {haConfig && (
            <Button 
              variant="destructive" 
              onClick={disableHa} 
              disabled={saving}
            >
              Disable HA
            </Button>
          )}
          <Button 
            onClick={() => setShowForm(true)} 
            disabled={saving}
          >
            {haConfig ? 'Edit HA Config' : 'Enable HA'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Current HA Configuration */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Current HA Status</h3>
        </CardHeader>
        <CardContent>
          {haConfig ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Server Name</div>
                  <div className="text-sm text-gray-600">{haConfig['this-server-name']}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Mode</div>
                  <div className="text-sm text-gray-600 capitalize">{haConfig.mode.replace('-', ' ')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Heartbeat Delay</div>
                  <div className="text-sm text-gray-600">{haConfig['heartbeat-delay']}ms</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Max Response Delay</div>
                  <div className="text-sm text-gray-600">{haConfig['max-response-delay']}ms</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Peers ({haConfig.peers.length})</div>
                <div className="space-y-2">
                  {haConfig.peers.map((peer, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{peer.name}</div>
                        <div className="text-sm text-gray-600">{peer.url}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium capitalize">{peer.role}</div>
                        <div className="text-xs text-gray-500">
                          Auto-failover: {peer['auto-failover'] ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">High Availability Not Configured</div>
              <div className="text-sm">Enable HA to configure failover and load balancing</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {haConfig ? 'Edit' : 'Configure'} High Availability
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    This Server Name *
                  </label>
                  <Input
                    value={serverName}
                    onChange={e => setServerName(e.target.value)}
                    placeholder="server1"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    HA Mode *
                  </label>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded"
                    disabled={saving}
                  >
                    <option value="hot-standby">Hot Standby</option>
                    <option value="load-balancing">Load Balancing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Heartbeat Delay (ms)
                  </label>
                  <Input
                    type="number"
                    value={heartbeatDelay}
                    onChange={e => setHeartbeatDelay(parseInt(e.target.value) || 10000)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max Response Delay (ms)
                  </label>
                  <Input
                    type="number"
                    value={maxResponseDelay}
                    onChange={e => setMaxResponseDelay(parseInt(e.target.value) || 60000)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Peers *
                </label>
                <div className="space-y-3">
                  {peers.map((peer, i) => (
                    <div key={i} className="border rounded p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Peer {i + 1}</h4>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePeer(i)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={peer.name}
                          onChange={e => updatePeer(i, 'name', e.target.value)}
                          placeholder="Peer name"
                          disabled={saving}
                        />
                        <Input
                          value={peer.url}
                          onChange={e => updatePeer(i, 'url', e.target.value)}
                          placeholder="http://peer-ip:8000/"
                          disabled={saving}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={peer.role}
                          onChange={e => updatePeer(i, 'role', e.target.value)}
                          className="px-3 py-2 border rounded"
                          disabled={saving}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                          <option value="backup">Backup</option>
                        </select>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={peer['auto-failover']}
                            onChange={e => updatePeer(i, 'auto-failover', e.target.checked)}
                            disabled={saving}
                          />
                          <span className="text-sm">Auto-failover</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addPeer}
                    disabled={saving}
                  >
                    Add Peer
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveHaConfig} disabled={saving || !serverName.trim()}>
                {saving ? 'Saving...' : 'Save HA Config'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HA Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">High Availability Guidelines</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Hot Standby:</strong> One server active, others standby. Automatic failover on failure.</div>
          <div>• <strong>Load Balancing:</strong> Multiple servers share the load. Better performance and redundancy.</div>
          <div>• <strong>Heartbeat:</strong> Frequency of health checks between peers (default: 10 seconds).</div>
          <div>• <strong>Response Delay:</strong> Maximum time to wait for peer response (default: 60 seconds).</div>
          <div>• <strong>Network Requirements:</strong> Peers must have network connectivity and synchronized time.</div>
        </div>
      </div>
    </div>
  )
}
