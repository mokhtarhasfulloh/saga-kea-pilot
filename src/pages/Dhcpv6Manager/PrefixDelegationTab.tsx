import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface PdPool {
  prefix: string
  'prefix-len': number
  'delegated-len': number
  'client-class'?: string
  'require-client-classes'?: string[]
}

interface Subnet6 {
  id?: number
  subnet: string
  'pd-pools'?: PdPool[]
}

export default function PrefixDelegationTab() {
  const [subnets, setSubnets] = useState<Subnet6[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedSubnetId, setSelectedSubnetId] = useState<number | null>(null)
  const [editingPool, setEditingPool] = useState<PdPool | null>(null)
  
  // Form state
  const [prefix, setPrefix] = useState('')
  const [prefixLen, setPrefixLen] = useState(48)
  const [delegatedLen, setDelegatedLen] = useState(64)
  const [clientClass, setClientClass] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}
      setSubnets(dhcp6.subnet6 || [])
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openForm(subnetId: number, pool?: PdPool) {
    setSelectedSubnetId(subnetId)
    setEditingPool(pool || null)
    setPrefix(pool?.prefix || '')
    setPrefixLen(pool?.['prefix-len'] || 48)
    setDelegatedLen(pool?.['delegated-len'] || 64)
    setClientClass(pool?.['client-class'] || '')
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setSelectedSubnetId(null)
    setEditingPool(null)
    setPrefix('')
    setPrefixLen(48)
    setDelegatedLen(64)
    setClientClass('')
    setError('')
  }

  function validateForm(): string | null {
    if (!prefix.trim()) return 'Prefix is required'
    
    // IPv6 prefix validation
    const ipv6PrefixRegex = /^(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4}\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/
    if (!ipv6PrefixRegex.test(prefix)) {
      return 'Invalid IPv6 prefix format (e.g., 2001:db8::/48)'
    }

    if (prefixLen < 1 || prefixLen > 128) {
      return 'Prefix length must be between 1-128'
    }

    if (delegatedLen < 1 || delegatedLen > 128) {
      return 'Delegated length must be between 1-128'
    }

    if (delegatedLen <= prefixLen) {
      return 'Delegated length must be greater than prefix length'
    }

    // Extract prefix length from the prefix string to validate consistency
    const prefixParts = prefix.split('/')
    if (prefixParts.length === 2) {
      const specifiedLen = parseInt(prefixParts[1])
      if (specifiedLen !== prefixLen) {
        return 'Prefix length in the prefix string must match the prefix length field'
      }
    }

    return null
  }

  async function savePdPool() {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!selectedSubnetId) {
      setError('No subnet selected')
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const poolData: PdPool = {
        prefix: prefix.trim(),
        'prefix-len': prefixLen,
        'delegated-len': delegatedLen,
        ...(clientClass.trim() && { 'client-class': clientClass.trim() })
      }

      let updatedSubnets = [...(dhcp6.subnet6 || [])]
      const subnetIndex = updatedSubnets.findIndex(s => s.id === selectedSubnetId)
      
      if (subnetIndex >= 0) {
        const subnet = updatedSubnets[subnetIndex]
        let pdPools = [...(subnet['pd-pools'] || [])]

        if (editingPool) {
          const poolIndex = pdPools.findIndex(p => 
            p.prefix === editingPool.prefix && 
            p['prefix-len'] === editingPool['prefix-len']
          )
          if (poolIndex >= 0) {
            pdPools[poolIndex] = poolData
          }
        } else {
          pdPools.push(poolData)
        }

        updatedSubnets[subnetIndex] = {
          ...subnet,
          'pd-pools': pdPools
        }
      }

      const updatedConfig = {
        ...dhcp6,
        subnet6: updatedSubnets
      }

      await Kea.action('config-test', { Dhcp6: updatedConfig })
      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      closeForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function deletePdPool(subnetId: number, pool: PdPool) {
    if (!confirm(`Delete prefix delegation pool ${pool.prefix}?`)) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      let updatedSubnets = [...(dhcp6.subnet6 || [])]
      const subnetIndex = updatedSubnets.findIndex(s => s.id === subnetId)
      
      if (subnetIndex >= 0) {
        const subnet = updatedSubnets[subnetIndex]
        const pdPools = (subnet['pd-pools'] || []).filter((p: any) =>
          !(p.prefix === pool.prefix && p['prefix-len'] === pool['prefix-len'])
        )

        updatedSubnets[subnetIndex] = {
          ...subnet,
          'pd-pools': pdPools
        }
      }

      const updatedConfig = {
        ...dhcp6,
        subnet6: updatedSubnets
      }

      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function calculateAvailablePrefixes(pool: PdPool): number {
    const prefixBits = pool['prefix-len']
    const delegatedBits = pool['delegated-len']
    const availableBits = delegatedBits - prefixBits
    return Math.pow(2, availableBits)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading prefix delegation configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">IPv6 Prefix Delegation</h2>
        <p className="text-sm text-gray-600">
          Configure prefix delegation pools for delegating IPv6 prefixes to routers and gateways
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Subnets with PD Pools */}
      <div className="space-y-4">
        {subnets.map((subnet) => (
          <Card key={subnet.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Subnet {subnet.id}: {subnet.subnet}</h3>
                  <p className="text-sm text-gray-600">
                    Prefix delegation pools for this subnet
                  </p>
                </div>
                <Button
                  onClick={() => openForm(subnet.id!)}
                  disabled={saving}
                  size="sm"
                >
                  Add PD Pool
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {subnet['pd-pools'] && subnet['pd-pools'].length > 0 ? (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Prefix</Th>
                      <Th>Prefix Length</Th>
                      <Th>Delegated Length</Th>
                      <Th>Available Prefixes</Th>
                      <Th>Client Class</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {subnet['pd-pools'].map((pool, i) => (
                      <Tr key={i}>
                        <Td className="font-mono">{pool.prefix}</Td>
                        <Td>/{pool['prefix-len']}</Td>
                        <Td>/{pool['delegated-len']}</Td>
                        <Td>{calculateAvailablePrefixes(pool).toLocaleString()}</Td>
                        <Td>{pool['client-class'] || 'Any'}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openForm(subnet.id!, pool)}
                              disabled={saving}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deletePdPool(subnet.id!, pool)}
                              disabled={saving}
                            >
                              Delete
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">No prefix delegation pools configured</div>
                  <div className="text-xs">Add a PD pool to enable prefix delegation for this subnet</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {subnets.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              <div className="text-lg mb-2">No IPv6 subnets configured</div>
              <div className="text-sm">Configure IPv6 subnets first in the Subnets6 tab</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PD Pool Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingPool ? 'Edit' : 'Add'} Prefix Delegation Pool
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  IPv6 Prefix *
                </label>
                <Input
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  placeholder="2001:db8:1000::/48"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  IPv6 prefix to delegate from (e.g., 2001:db8:1000::/48)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Prefix Length *
                  </label>
                  <Input
                    type="number"
                    value={prefixLen}
                    onChange={e => setPrefixLen(parseInt(e.target.value) || 48)}
                    min={1}
                    max={128}
                    disabled={saving}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Length of the pool prefix (typically 48)
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Delegated Length *
                  </label>
                  <Input
                    type="number"
                    value={delegatedLen}
                    onChange={e => setDelegatedLen(parseInt(e.target.value) || 64)}
                    min={1}
                    max={128}
                    disabled={saving}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Length of delegated prefixes (typically 64)
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Class (Optional)
                </label>
                <Input
                  value={clientClass}
                  onChange={e => setClientClass(e.target.value)}
                  placeholder="ROUTERS"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Restrict this pool to specific client class
                </div>
              </div>

              {/* Calculation Preview */}
              {prefix && prefixLen && delegatedLen && delegatedLen > prefixLen && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="text-sm font-medium text-blue-800 mb-1">Pool Calculation</div>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>Pool prefix: {prefix}</div>
                    <div>Available prefixes: {Math.pow(2, delegatedLen - prefixLen).toLocaleString()}</div>
                    <div>Each delegated prefix: /{delegatedLen}</div>
                    <div>Example delegated prefix: {prefix.split('/')[0].replace(/::$/, '')}:1::/{delegatedLen}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={savePdPool} disabled={saving || !prefix.trim()}>
                {saving ? 'Saving...' : 'Save PD Pool'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prefix Delegation Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Prefix Delegation Guidelines</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Typical Setup:</strong> /48 pool delegating /64 prefixes (65,536 available prefixes)</div>
          <div>• <strong>ISP Setup:</strong> /32 pool delegating /48 prefixes for customer routers</div>
          <div>• <strong>Enterprise:</strong> /56 pool delegating /64 prefixes for department networks</div>
          <div>• <strong>Client Types:</strong> Usually routers, firewalls, or other gateway devices</div>
          <div>• <strong>Use Cases:</strong> Customer premise equipment, branch offices, IoT gateways</div>
        </div>
      </div>
    </div>
  )
}
