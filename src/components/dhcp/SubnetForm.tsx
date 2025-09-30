import { useState } from 'react'
import Button from '../ui/button'
import Input from '../ui/input'
import { Alert } from '../ui/alert'
import { Card, CardHeader, CardContent } from '../ui/card'
import RelayControls, { validateRelayConfig, SubnetRelayConfig } from './RelayControls'
import { poolWithinCidr, poolsOverlap } from '../../lib/ip'

interface Pool {
  pool: string
}

interface SubnetConfig {
  id?: number
  subnet: string
  pools: Pool[]
  'client-class'?: string
  'require-client-classes'?: string[]
  relay?: {
    'ip-addresses': string[]
  }
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

interface SubnetFormProps {
  subnet?: SubnetConfig
  onSave: (subnet: SubnetConfig) => Promise<void>
  onCancel: () => void
  saving?: boolean
}

export default function SubnetForm({ subnet, onSave, onCancel, saving }: SubnetFormProps) {
  const [subnetCIDR, setSubnetCIDR] = useState(subnet?.subnet || '')
  const [pools, setPools] = useState<string[]>(
    subnet?.pools?.map(p => p.pool) || ['']
  )
  const [clientClass, setClientClass] = useState(subnet?.['client-class'] || '')
  const [requireClasses, setRequireClasses] = useState(
    subnet?.['require-client-classes']?.join(', ') || ''
  )
  const [relayConfig, setRelayConfig] = useState<SubnetRelayConfig>({
    relay: subnet?.relay,
    'relay-agent-info': subnet?.['relay-agent-info'],
    'subnet-selection': subnet?.['subnet-selection']
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')

  function addPool() {
    setPools([...pools, ''])
  }

  function removePool(index: number) {
    setPools(pools.filter((_, i) => i !== index))
  }

  function updatePool(index: number, value: string) {
    const newPools = [...pools]
    newPools[index] = value
    setPools(newPools)
  }

  function validate(): string | null {
    if (!subnetCIDR.trim()) return 'Enter subnet in CIDR format'
    
    const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/
    if (!cidrRegex.test(subnetCIDR)) return 'Invalid CIDR format'

    const validPools = pools.map(p => p.trim()).filter(Boolean)
    if (validPools.length === 0) return 'At least one pool is required'
    
    if (poolsOverlap(validPools)) return 'Pools overlap'
    
    for (const pool of validPools) {
      if (!poolWithinCidr(pool, subnetCIDR)) {
        return `Pool ${pool} is not within subnet ${subnetCIDR}`
      }
    }

    // Validate relay configuration
    const relayErrors = validateRelayConfig(relayConfig)
    if (relayErrors.length > 0) {
      return relayErrors[0]
    }

    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    
    const subnetData: SubnetConfig = {
      ...(subnet?.id && { id: subnet.id }),
      subnet: subnetCIDR.trim(),
      pools: pools.map(p => p.trim()).filter(Boolean).map(pool => ({ pool })),
      ...(clientClass.trim() && { 'client-class': clientClass.trim() }),
      ...(requireClasses.trim() && { 
        'require-client-classes': requireClasses.split(',').map(c => c.trim()).filter(Boolean)
      }),
      ...(relayConfig.relay && { relay: relayConfig.relay }),
      ...(relayConfig['relay-agent-info'] && { 'relay-agent-info': relayConfig['relay-agent-info'] }),
      ...(relayConfig['subnet-selection'] && { 'subnet-selection': relayConfig['subnet-selection'] })
    }

    try {
      await onSave(subnetData)
    } catch (e: any) {
      setError(String(e))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {subnet ? 'Edit' : 'Add'} Subnet
        </h3>

        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

        <div className="space-y-6">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <h4 className="font-medium">Basic Configuration</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Subnet CIDR *
                </label>
                <Input
                  value={subnetCIDR}
                  onChange={e => setSubnetCIDR(e.target.value)}
                  placeholder="192.168.1.0/24"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  IP Pools *
                </label>
                <div className="space-y-2">
                  {pools.map((pool, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={pool}
                        onChange={e => updatePool(i, e.target.value)}
                        placeholder="192.168.1.100 - 192.168.1.200"
                        disabled={saving}
                      />
                      {pools.length > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => removePool(i)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addPool}
                    disabled={saving}
                  >
                    Add Pool
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Classes */}
          <Card>
            <CardHeader>
              <h4 className="font-medium">Client Classification</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Class
                </label>
                <Input
                  value={clientClass}
                  onChange={e => setClientClass(e.target.value)}
                  placeholder="e.g., KNOWN"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Optional client class for this subnet
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Required Client Classes
                </label>
                <Input
                  value={requireClasses}
                  onChange={e => setRequireClasses(e.target.value)}
                  placeholder="class1, class2"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Comma-separated list of required client classes
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relay Configuration */}
          <RelayControls
            config={relayConfig}
            onChange={(config) => setRelayConfig(config)}
            disabled={saving}
          />

          {/* Advanced Options */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Advanced Options</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  disabled={saving}
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>
            </CardHeader>
            {showAdvanced && (
              <CardContent>
                <div className="text-sm text-gray-600">
                  Additional subnet options like timers, reservations, and custom options 
                  can be configured here in future versions.
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !subnetCIDR.trim()}
          >
            {saving ? 'Saving...' : 'Save Subnet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
