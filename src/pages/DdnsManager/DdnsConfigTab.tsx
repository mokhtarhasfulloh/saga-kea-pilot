import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

interface DdnsConfig {
  'ddns-send-updates': boolean
  'ddns-override-no-update': boolean
  'ddns-override-client-update': boolean
  'ddns-replace-client-name': 'never' | 'always' | 'when-present' | 'when-not-present'
  'ddns-generated-prefix': string
  'ddns-qualifying-suffix': string
  'ddns-update-on-renew': boolean
  'ddns-conflict-resolution-mode': 'check-with-dhcid' | 'no-check-with-dhcid' | 'check-exists-with-dhcid' | 'no-check-without-dhcid'
  'dhcp-ddns': {
    'enable-updates': boolean
    'server-ip': string
    'server-port': number
    'sender-ip': string
    'sender-port': number
    'max-queue-size': number
    'ncr-protocol': 'UDP' | 'TCP'
    'ncr-format': 'JSON'
  }
}

export default function DdnsConfigTab() {
  // const [ddnsConfig, setDdnsConfig] = useState<Partial<DdnsConfig> | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [sendUpdates, setSendUpdates] = useState(false)
  const [overrideNoUpdate, setOverrideNoUpdate] = useState(false)
  const [overrideClientUpdate, setOverrideClientUpdate] = useState(false)
  const [replaceClientName, setReplaceClientName] = useState<DdnsConfig['ddns-replace-client-name']>('never')
  const [generatedPrefix, setGeneratedPrefix] = useState('myhost')
  const [qualifyingSuffix, setQualifyingSuffix] = useState('')
  const [updateOnRenew, setUpdateOnRenew] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<DdnsConfig['ddns-conflict-resolution-mode']>('check-with-dhcid')
  
  // DHCP-DDNS daemon settings
  const [enableDdnsDaemon, setEnableDdnsDaemon] = useState(false)
  const [serverIp, setServerIp] = useState('127.0.0.1')
  const [serverPort, setServerPort] = useState(53001)
  const [senderIp, setSenderIp] = useState('0.0.0.0')
  const [senderPort, setSenderPort] = useState(0)
  const [maxQueueSize, setMaxQueueSize] = useState(1024)
  const [ncrProtocol, setNcrProtocol] = useState<'UDP' | 'TCP'>('UDP')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}
      
      // Extract DDNS settings
      setSendUpdates(dhcp4['ddns-send-updates'] || false)
      setOverrideNoUpdate(dhcp4['ddns-override-no-update'] || false)
      setOverrideClientUpdate(dhcp4['ddns-override-client-update'] || false)
      setReplaceClientName(dhcp4['ddns-replace-client-name'] || 'never')
      setGeneratedPrefix(dhcp4['ddns-generated-prefix'] || 'myhost')
      setQualifyingSuffix(dhcp4['ddns-qualifying-suffix'] || '')
      setUpdateOnRenew(dhcp4['ddns-update-on-renew'] || false)
      setConflictResolution(dhcp4['ddns-conflict-resolution-mode'] || 'check-with-dhcid')
      
      // Extract DHCP-DDNS daemon settings
      const dhcpDdns = dhcp4['dhcp-ddns']
      if (dhcpDdns) {
        setEnableDdnsDaemon(dhcpDdns['enable-updates'] || false)
        setServerIp(dhcpDdns['server-ip'] || '127.0.0.1')
        setServerPort(dhcpDdns['server-port'] || 53001)
        setSenderIp(dhcpDdns['sender-ip'] || '0.0.0.0')
        setSenderPort(dhcpDdns['sender-port'] || 0)
        setMaxQueueSize(dhcpDdns['max-queue-size'] || 1024)
        setNcrProtocol(dhcpDdns['ncr-protocol'] || 'UDP')
      }
      
      // setDdnsConfig(dhcp4)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function saveDdnsConfig() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      const updatedConfig = {
        ...dhcp4,
        'ddns-send-updates': sendUpdates,
        'ddns-override-no-update': overrideNoUpdate,
        'ddns-override-client-update': overrideClientUpdate,
        'ddns-replace-client-name': replaceClientName,
        'ddns-generated-prefix': generatedPrefix,
        'ddns-qualifying-suffix': qualifyingSuffix,
        'ddns-update-on-renew': updateOnRenew,
        'ddns-conflict-resolution-mode': conflictResolution,
        'dhcp-ddns': {
          'enable-updates': enableDdnsDaemon,
          'server-ip': serverIp,
          'server-port': serverPort,
          'sender-ip': senderIp,
          'sender-port': senderPort,
          'max-queue-size': maxQueueSize,
          'ncr-protocol': ncrProtocol,
          'ncr-format': 'JSON' as const
        }
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      setSuccess('DDNS configuration saved successfully')
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
        <div className="text-gray-500">Loading DDNS configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">DHCP-DDNS Configuration</h2>
          <p className="text-sm text-gray-600">
            Configure Dynamic DNS updates for DHCP clients
          </p>
        </div>
        <Button onClick={saveDdnsConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* DDNS Global Settings */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Global DDNS Settings</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={sendUpdates}
                onChange={e => setSendUpdates(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm font-medium">Enable DDNS Updates</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overrideNoUpdate}
                onChange={e => setOverrideNoUpdate(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm font-medium">Override No-Update Flag</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overrideClientUpdate}
                onChange={e => setOverrideClientUpdate(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm font-medium">Override Client Update</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={updateOnRenew}
                onChange={e => setUpdateOnRenew(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm font-medium">Update on Renew</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Replace Client Name
              </label>
              <select
                value={replaceClientName}
                onChange={e => setReplaceClientName(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
                disabled={saving}
              >
                <option value="never">Never</option>
                <option value="always">Always</option>
                <option value="when-present">When Present</option>
                <option value="when-not-present">When Not Present</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Conflict Resolution Mode
              </label>
              <select
                value={conflictResolution}
                onChange={e => setConflictResolution(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
                disabled={saving}
              >
                <option value="check-with-dhcid">Check with DHCID</option>
                <option value="no-check-with-dhcid">No Check with DHCID</option>
                <option value="check-exists-with-dhcid">Check Exists with DHCID</option>
                <option value="no-check-without-dhcid">No Check without DHCID</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Generated Prefix
              </label>
              <Input
                value={generatedPrefix}
                onChange={e => setGeneratedPrefix(e.target.value)}
                placeholder="myhost"
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                Prefix for generated hostnames when client doesn't provide one
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Qualifying Suffix
              </label>
              <Input
                value={qualifyingSuffix}
                onChange={e => setQualifyingSuffix(e.target.value)}
                placeholder="example.com"
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                Domain suffix appended to unqualified hostnames
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DHCP-DDNS Daemon Settings */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">DHCP-DDNS Daemon Settings</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={enableDdnsDaemon}
              onChange={e => setEnableDdnsDaemon(e.target.checked)}
              disabled={saving}
            />
            <span className="text-sm font-medium">Enable DHCP-DDNS Daemon Communication</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                DDNS Server IP
              </label>
              <Input
                value={serverIp}
                onChange={e => setServerIp(e.target.value)}
                placeholder="127.0.0.1"
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                IP address of the DHCP-DDNS daemon
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                DDNS Server Port
              </label>
              <Input
                type="number"
                value={serverPort}
                onChange={e => setServerPort(parseInt(e.target.value) || 53001)}
                min={1}
                max={65535}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Sender IP
              </label>
              <Input
                value={senderIp}
                onChange={e => setSenderIp(e.target.value)}
                placeholder="0.0.0.0"
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                Source IP for outgoing DDNS requests (0.0.0.0 = any)
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Sender Port
              </label>
              <Input
                type="number"
                value={senderPort}
                onChange={e => setSenderPort(parseInt(e.target.value) || 0)}
                min={0}
                max={65535}
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                Source port (0 = random)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Queue Size
              </label>
              <Input
                type="number"
                value={maxQueueSize}
                onChange={e => setMaxQueueSize(parseInt(e.target.value) || 1024)}
                min={1}
                disabled={saving}
              />
              <div className="text-xs text-gray-500 mt-1">
                Maximum number of queued DDNS requests
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                NCR Protocol
              </label>
              <select
                value={ncrProtocol}
                onChange={e => setNcrProtocol(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
                disabled={saving}
              >
                <option value="UDP">UDP</option>
                <option value="TCP">TCP</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Protocol for Name Change Requests
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DDNS Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">DDNS Configuration Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Enable DDNS:</strong> Turn on ddns-send-updates to enable DNS updates</div>
          <div>• <strong>Client Name Handling:</strong> Control how client-provided hostnames are processed</div>
          <div>• <strong>Conflict Resolution:</strong> Handle DNS record conflicts with DHCID records</div>
          <div>• <strong>DDNS Daemon:</strong> Separate process that handles actual DNS updates</div>
          <div>• <strong>Forward/Reverse:</strong> Updates both A/AAAA and PTR records automatically</div>
          <div>• <strong>Requirements:</strong> DNS server must support dynamic updates (RFC 2136)</div>
        </div>
      </div>
    </div>
  )
}
