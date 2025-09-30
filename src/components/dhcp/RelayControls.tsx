import { useState } from 'react'
import Button from '../ui/button'
import Input from '../ui/input'
// import { Alert } from '../ui/alert'
import { Card, CardHeader, CardContent } from '../ui/card'

interface RelayConfig {
  'ip-addresses': string[]
}

export interface SubnetRelayConfig {
  relay?: RelayConfig
  'relay-agent-info'?: {
    'link-selection'?: string
    'server-id-override'?: boolean
    'circuit-id'?: string
    'remote-id'?: string
  }
  'subnet-selection'?: {
    'giaddr-based'?: boolean
    'client-class-based'?: boolean
  }
}

interface RelayControlsProps {
  config: SubnetRelayConfig
  onChange: (config: SubnetRelayConfig) => void
  disabled?: boolean
}

export default function RelayControls({ config, onChange, disabled }: RelayControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  // const [error, setError] = useState('')

  function updateRelayAddresses(addresses: string) {
    const ipList = addresses.split(',').map(ip => ip.trim()).filter(Boolean)
    const newConfig = {
      ...config,
      relay: ipList.length > 0 ? { 'ip-addresses': ipList } : undefined
    }
    onChange(newConfig)
  }



  function updateSubnetSelection(field: string, value: boolean) {
    const newConfig = {
      ...config,
      'subnet-selection': {
        ...config['subnet-selection'],
        [field]: value
      }
    }
    onChange(newConfig)
  }

  const relayAddresses = config.relay?.['ip-addresses']?.join(', ') || ''

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">Relay & Subnet Selection</h3>
            <p className="text-sm text-gray-600">
              Configure DHCP relay agents and subnet selection criteria
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={disabled}
          >
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* {error && <Alert variant="error">{error}</Alert>} */}

        {/* Basic Relay Configuration */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Relay Agent IP Addresses
          </label>
          <Input
            value={relayAddresses}
            onChange={e => updateRelayAddresses(e.target.value)}
            placeholder="10.0.1.1, 10.0.2.1"
            disabled={disabled}
          />
          <div className="text-xs text-gray-500 mt-1">
            Comma-separated IP addresses of DHCP relay agents (giaddr)
          </div>
        </div>

        {/* Subnet Selection Options */}
        <div>
          <label className="block text-sm font-medium mb-2">Subnet Selection Method</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config['subnet-selection']?.['giaddr-based'] || false}
                onChange={e => updateSubnetSelection('giaddr-based', e.target.checked)}
                disabled={disabled}
              />
              <span className="text-sm">Gateway Address (giaddr) Based Selection</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config['subnet-selection']?.['client-class-based'] || false}
                onChange={e => updateSubnetSelection('client-class-based', e.target.checked)}
                disabled={disabled}
              />
              <span className="text-sm">Client Class Based Selection</span>
            </label>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            How Kea should select the appropriate subnet for relayed requests
          </div>
        </div>

        {/* Advanced Relay Configuration */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Advanced Relay Configuration</h4>

              {/* Note about Option 82 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <h5 className="font-medium text-sm text-yellow-800 mb-1">Option 82 (Relay Agent Information)</h5>
                <div className="text-xs text-yellow-700 space-y-1">
                  <p>• Option 82 processing is handled by Kea's built-in relay agent support</p>
                  <p>• Circuit ID and Remote ID are automatically processed when present</p>
                  <p>• Use client classes to match specific Option 82 values</p>
                  <p>• Link selection is supported via the relay configuration above</p>
                </div>
              </div>

              {/* Client Class Integration */}
              <div>
                <h5 className="font-medium text-sm mb-2">Client Class Integration</h5>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Use client classes to handle Option 82 processing:</p>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                    {`{
  "name": "circuit-id-match",
  "test": "relay4[1].hex == 0x736f6d652d737472696e67"
}`}
                  </div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                    {`{
  "name": "remote-id-match",
  "test": "relay4[2].hex == 0x6d61632d61646472657373"
}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Relay Behavior Notes */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <h5 className="font-medium text-sm text-blue-800 mb-1">Relay Behavior Notes</h5>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>Local Traffic:</strong> Clients on same subnet as DHCP server (giaddr = 0.0.0.0)</li>
                <li>• <strong>Relayed Traffic:</strong> Clients behind relay agents (giaddr = relay IP)</li>
                <li>• <strong>Link Selection:</strong> Overrides normal giaddr-based subnet selection</li>
                <li>• <strong>Option 82:</strong> Provides additional context for subnet/pool selection</li>
              </ul>
            </div>
          </div>
        )}

        {/* Configuration Preview */}
        {(relayAddresses || config['subnet-selection']) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Configuration Preview</h4>
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto">
              {JSON.stringify({
                ...(config.relay && { relay: config.relay }),
                ...(config['subnet-selection'] && { 'subnet-selection': config['subnet-selection'] })
              }, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper component for subnet-specific relay settings
export function SubnetRelaySettings({ 
  subnetId, 
  config, 
  onChange, 
  disabled 
}: { 
  subnetId: number
  config: SubnetRelayConfig
  onChange: (config: SubnetRelayConfig) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Relay Settings for Subnet {subnetId}</div>
      <RelayControls config={config} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// Validation helpers
export function validateRelayConfig(config: SubnetRelayConfig): string[] {
  const errors: string[] = []

  if (config.relay?.['ip-addresses']) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

    for (const ip of config.relay['ip-addresses']) {
      if (!ipRegex.test(ip)) {
        errors.push(`Invalid relay IP address: ${ip}`)
      }
    }
  }

  return errors
}
