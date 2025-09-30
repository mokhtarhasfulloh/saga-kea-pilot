import { useState } from 'react'
import Button from '../ui/button'
import Input from '../ui/input'
import { Alert } from '../ui/alert'
import { Card, CardHeader, CardContent } from '../ui/card'

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

interface ServerBehaviorControlsProps {
  config: ServerBehaviorConfig
  onChange: (config: ServerBehaviorConfig) => void
  disabled?: boolean
}

export default function ServerBehaviorControls({ config, onChange, disabled }: ServerBehaviorControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  // const [error, setError] = useState('')

  function updateConfig(field: keyof ServerBehaviorConfig, value: any) {
    const newConfig = { ...config, [field]: value }
    onChange(newConfig)
  }

  function validateTimers(): string | null {
    const valid = config['valid-lifetime'] || 3600
    const renew = config['renew-timer'] || Math.floor(valid * 0.5)
    const rebind = config['rebind-timer'] || Math.floor(valid * 0.875)

    if (renew >= rebind) {
      return 'Renew timer must be less than rebind timer'
    }
    if (rebind >= valid) {
      return 'Rebind timer must be less than valid lifetime'
    }
    if (config['min-valid-lifetime'] && config['min-valid-lifetime'] > valid) {
      return 'Minimum valid lifetime cannot be greater than valid lifetime'
    }
    if (config['max-valid-lifetime'] && config['max-valid-lifetime'] < valid) {
      return 'Maximum valid lifetime cannot be less than valid lifetime'
    }
    return null
  }

  const timerError = validateTimers()

  return (
    <div className="space-y-4">
      {/* {error && <Alert variant="error">{error}</Alert>} */}
      {timerError && <Alert variant="error">{timerError}</Alert>}

      {/* Basic Compatibility Settings */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Client Compatibility</h3>
          <p className="text-sm text-gray-600">
            Configure server behavior for compatibility with different DHCP clients
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config['echo-client-id'] !== false}
                  onChange={e => updateConfig('echo-client-id', e.target.checked)}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">Echo Client ID</span>
              </label>
              <div className="text-xs text-gray-500 mt-1">
                Include client identifier (option 61) in DHCP responses. 
                Disable for clients that don't handle this properly.
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config['match-client-id'] !== false}
                  onChange={e => updateConfig('match-client-id', e.target.checked)}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">Match Client ID</span>
              </label>
              <div className="text-xs text-gray-500 mt-1">
                Use client identifier for lease matching instead of MAC address.
                Disable for legacy clients.
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.authoritative === true}
                  onChange={e => updateConfig('authoritative', e.target.checked)}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">Authoritative</span>
              </label>
              <div className="text-xs text-gray-500 mt-1">
                Send DHCPNAK for unknown leases. Enable if this is the only DHCP server.
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">
                <span className="font-medium">Lenient Option Parsing</span>
                <span className="ml-2 text-xs">(Not supported in this Kea version)</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Would accept malformed DHCP options from clients if supported.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lease Timers */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Lease Timers</h3>
          <p className="text-sm text-gray-600">
            Configure DHCP lease timing parameters (T1, T2, and valid lifetime)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Valid Lifetime (seconds)
              </label>
              <Input
                type="number"
                value={config['valid-lifetime'] || 3600}
                onChange={e => updateConfig('valid-lifetime', parseInt(e.target.value) || 3600)}
                min={60}
                max={4294967295}
                disabled={disabled}
              />
              <div className="text-xs text-gray-500 mt-1">
                How long a lease is valid (default: 3600s = 1 hour)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Renew Timer (T1)
              </label>
              <Input
                type="number"
                value={config['renew-timer'] || Math.floor((config['valid-lifetime'] || 3600) * 0.5)}
                onChange={e => updateConfig('renew-timer', parseInt(e.target.value) || undefined)}
                min={1}
                disabled={disabled}
              />
              <div className="text-xs text-gray-500 mt-1">
                When client should start renewing (default: 50% of valid lifetime)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Rebind Timer (T2)
              </label>
              <Input
                type="number"
                value={config['rebind-timer'] || Math.floor((config['valid-lifetime'] || 3600) * 0.875)}
                onChange={e => updateConfig('rebind-timer', parseInt(e.target.value) || undefined)}
                min={1}
                disabled={disabled}
              />
              <div className="text-xs text-gray-500 mt-1">
                When client should start rebinding (default: 87.5% of valid lifetime)
              </div>
            </div>
          </div>

          {/* Timer Visualization */}
          <div className="bg-muted p-3 rounded">
            <div className="text-xs font-medium mb-2">Timer Relationship</div>
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex-1 bg-green-200 dark:bg-green-950/30 h-4 rounded-l flex items-center justify-center text-green-800 dark:text-green-400">
                T1 ({config['renew-timer'] || Math.floor((config['valid-lifetime'] || 3600) * 0.5)}s)
              </div>
              <div className="flex-1 bg-yellow-200 dark:bg-yellow-950/30 h-4 flex items-center justify-center text-yellow-800 dark:text-yellow-400">
                T2 ({config['rebind-timer'] || Math.floor((config['valid-lifetime'] || 3600) * 0.875)}s)
              </div>
              <div className="flex-1 bg-red-200 dark:bg-red-950/30 h-4 rounded-r flex items-center justify-center text-red-800 dark:text-red-400">
                Expire ({config['valid-lifetime'] || 3600}s)
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Green: Renew with original server | Yellow: Rebind with any server | Red: Lease expires
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Advanced Settings</h3>
              <p className="text-sm text-gray-600">
                Additional server behavior and boot options
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={disabled}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Minimum Valid Lifetime
                </label>
                <Input
                  type="number"
                  value={config['min-valid-lifetime'] || ''}
                  onChange={e => updateConfig('min-valid-lifetime', parseInt(e.target.value) || undefined)}
                  placeholder="60"
                  min={1}
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Minimum lease time clients can request
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Maximum Valid Lifetime
                </label>
                <Input
                  type="number"
                  value={config['max-valid-lifetime'] || ''}
                  onChange={e => updateConfig('max-valid-lifetime', parseInt(e.target.value) || undefined)}
                  placeholder="86400"
                  min={1}
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Maximum lease time clients can request
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Decline Probation Period
                </label>
                <Input
                  type="number"
                  value={config['decline-probation-period'] || ''}
                  onChange={e => updateConfig('decline-probation-period', parseInt(e.target.value) || undefined)}
                  placeholder="86400"
                  min={1}
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  How long to avoid declined addresses (seconds)
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  DHCPv4-over-DHCPv6 Port
                </label>
                <Input
                  type="number"
                  value={config['dhcp4o6-port'] || ''}
                  onChange={e => updateConfig('dhcp4o6-port', parseInt(e.target.value) || undefined)}
                  placeholder="6767"
                  min={1}
                  max={65535}
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Port for DHCPv4-over-DHCPv6 communication
                </div>
              </div>
            </div>

            {/* Boot Options */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-3">Global Boot Options</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Server Hostname
                  </label>
                  <Input
                    value={config['server-hostname'] || ''}
                    onChange={e => updateConfig('server-hostname', e.target.value || undefined)}
                    placeholder="tftp.example.com"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    TFTP server hostname (option 66)
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Boot File Name
                  </label>
                  <Input
                    value={config['boot-file-name'] || ''}
                    onChange={e => updateConfig('boot-file-name', e.target.value || undefined)}
                    placeholder="pxelinux.0"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Boot file name (option 67)
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Next Server IP
                  </label>
                  <Input
                    value={config['next-server'] || ''}
                    onChange={e => updateConfig('next-server', e.target.value || undefined)}
                    placeholder="10.0.0.100"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    TFTP server IP address (siaddr field)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Configuration Preview */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configuration Preview</h3>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto">
            {JSON.stringify(
              Object.fromEntries(
                Object.entries(config).filter(([_, value]) => value !== undefined)
              ), 
              null, 
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
