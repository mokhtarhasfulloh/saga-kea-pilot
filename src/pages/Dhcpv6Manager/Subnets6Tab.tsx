import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface Pool6 {
  pool: string
  'client-class'?: string
  'require-client-classes'?: string[]
}

interface Subnet6 {
  id?: number
  subnet: string
  pools?: Pool6[]
  'pd-pools'?: Array<{
    prefix: string
    'prefix-len': number
    'delegated-len': number
  }>
  'preferred-lifetime'?: number
  'valid-lifetime'?: number
  'renew-timer'?: number
  'rebind-timer'?: number
  'rapid-commit'?: boolean
}

export default function Subnets6Tab() {
  const [subnets, setSubnets] = useState<Subnet6[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSubnet, setEditingSubnet] = useState<Subnet6 | null>(null)
  
  // Form state
  const [subnetPrefix, setSubnetPrefix] = useState('')
  const [pools, setPools] = useState<string[]>([''])
  const [preferredLifetime, setPreferredLifetime] = useState(3600)
  const [validLifetime, setValidLifetime] = useState(7200)
  const [renewTimer, setRenewTimer] = useState(1800)
  const [rebindTimer, setRebindTimer] = useState(2880)
  const [rapidCommit, setRapidCommit] = useState(false)
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

  function openForm(subnet?: Subnet6) {
    setEditingSubnet(subnet || null)
    setSubnetPrefix(subnet?.subnet || '')
    setPools(subnet?.pools?.map(p => p.pool) || [''])
    setPreferredLifetime(subnet?.['preferred-lifetime'] || 3600)
    setValidLifetime(subnet?.['valid-lifetime'] || 7200)
    setRenewTimer(subnet?.['renew-timer'] || 1800)
    setRebindTimer(subnet?.['rebind-timer'] || 2880)
    setRapidCommit(subnet?.['rapid-commit'] || false)
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingSubnet(null)
    setSubnetPrefix('')
    setPools([''])
    setPreferredLifetime(3600)
    setValidLifetime(7200)
    setRenewTimer(1800)
    setRebindTimer(2880)
    setRapidCommit(false)
    setError('')
  }

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

  function validateForm(): string | null {
    if (!subnetPrefix.trim()) return 'Subnet prefix is required'
    
    // Basic IPv6 prefix validation
    const ipv6PrefixRegex = /^(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4}\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/
    if (!ipv6PrefixRegex.test(subnetPrefix)) {
      return 'Invalid IPv6 prefix format (e.g., 2001:db8::/64)'
    }

    const validPools = pools.map(p => p.trim()).filter(Boolean)
    if (validPools.length === 0) return 'At least one pool is required'

    // Validate pool formats
    for (const pool of validPools) {
      if (pool.includes('-')) {
        const [start, end] = pool.split('-')
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/
        if (!ipv6Regex.test(start.trim()) || !ipv6Regex.test(end.trim())) {
          return `Invalid IPv6 pool format: ${pool}`
        }
      } else if (!ipv6PrefixRegex.test(pool)) {
        return `Invalid IPv6 pool format: ${pool}`
      }
    }

    // Validate timers
    if (renewTimer >= rebindTimer) {
      return 'Renew timer must be less than rebind timer'
    }
    if (rebindTimer >= validLifetime) {
      return 'Rebind timer must be less than valid lifetime'
    }
    if (preferredLifetime > validLifetime) {
      return 'Preferred lifetime cannot be greater than valid lifetime'
    }

    return null
  }

  async function saveSubnet() {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const subnetData: Subnet6 = {
        ...(editingSubnet?.id && { id: editingSubnet.id }),
        subnet: subnetPrefix.trim(),
        pools: pools.map(p => p.trim()).filter(Boolean).map(pool => ({ pool })),
        'preferred-lifetime': preferredLifetime,
        'valid-lifetime': validLifetime,
        'renew-timer': renewTimer,
        'rebind-timer': rebindTimer,
        'rapid-commit': rapidCommit
      }

      let updatedSubnets = [...(dhcp6.subnet6 || [])]
      
      if (editingSubnet) {
        const index = updatedSubnets.findIndex(s => s.id === editingSubnet.id)
        if (index >= 0) {
          updatedSubnets[index] = subnetData
        }
      } else {
        // Assign new ID
        const maxId = Math.max(0, ...updatedSubnets.map(s => s.id || 0))
        subnetData.id = maxId + 1
        updatedSubnets.push(subnetData)
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

  async function deleteSubnet(subnetId?: number) {
    if (!subnetId || !confirm('Delete this IPv6 subnet?')) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const updatedSubnets = (dhcp6.subnet6 || []).filter((s: any) => s.id !== subnetId)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading IPv6 subnets...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">IPv6 Subnets</h2>
          <p className="text-sm text-gray-600">
            Manage DHCPv6 subnets and address pools for IPv6 clients
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Add IPv6 Subnet
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Subnets List */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configured IPv6 Subnets</h3>
        </CardHeader>
        <CardContent>
          {subnets.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Subnet</Th>
                  <Th>Pools</Th>
                  <Th>Timers (P/V/T1/T2)</Th>
                  <Th>Rapid Commit</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {subnets.map((subnet, i) => (
                  <Tr key={i}>
                    <Td>{subnet.id || 'N/A'}</Td>
                    <Td className="font-mono">{subnet.subnet}</Td>
                    <Td>
                      <div className="text-xs">
                        {subnet.pools?.map(p => p.pool).join(', ') || 'No pools'}
                      </div>
                    </Td>
                    <Td className="text-xs">
                      {subnet['preferred-lifetime'] || 3600}s / 
                      {subnet['valid-lifetime'] || 7200}s / 
                      {subnet['renew-timer'] || 1800}s / 
                      {subnet['rebind-timer'] || 2880}s
                    </Td>
                    <Td>
                      {subnet['rapid-commit'] ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openForm(subnet)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSubnet(subnet.id)}
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
              <div className="text-lg mb-2">No IPv6 subnets configured</div>
              <div className="text-sm">Add an IPv6 subnet to start serving DHCPv6 clients</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subnet Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingSubnet ? 'Edit' : 'Add'} IPv6 Subnet
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  IPv6 Subnet Prefix *
                </label>
                <Input
                  value={subnetPrefix}
                  onChange={e => setSubnetPrefix(e.target.value)}
                  placeholder="2001:db8::/64"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  IPv6 prefix in CIDR notation (e.g., 2001:db8::/64)
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Address Pools *
                </label>
                <div className="space-y-2">
                  {pools.map((pool, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={pool}
                        onChange={e => updatePool(i, e.target.value)}
                        placeholder="2001:db8::100 - 2001:db8::200 or 2001:db8:1::/64"
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
                <div className="text-xs text-gray-500 mt-1">
                  IPv6 address ranges or prefixes for client allocation
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Preferred Lifetime (seconds)
                  </label>
                  <Input
                    type="number"
                    value={preferredLifetime}
                    onChange={e => setPreferredLifetime(parseInt(e.target.value) || 3600)}
                    min={0}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Valid Lifetime (seconds)
                  </label>
                  <Input
                    type="number"
                    value={validLifetime}
                    onChange={e => setValidLifetime(parseInt(e.target.value) || 7200)}
                    min={0}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Renew Timer (T1)
                  </label>
                  <Input
                    type="number"
                    value={renewTimer}
                    onChange={e => setRenewTimer(parseInt(e.target.value) || 1800)}
                    min={0}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Rebind Timer (T2)
                  </label>
                  <Input
                    type="number"
                    value={rebindTimer}
                    onChange={e => setRebindTimer(parseInt(e.target.value) || 2880)}
                    min={0}
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={rapidCommit}
                    onChange={e => setRapidCommit(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm font-medium">Enable Rapid Commit</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  Allow 2-message exchange instead of 4-message for faster address assignment
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveSubnet} disabled={saving || !subnetPrefix.trim()}>
                {saving ? 'Saving...' : 'Save Subnet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IPv6 Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">IPv6 Subnet Guidelines</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• Use /64 prefixes for most client subnets (standard recommendation)</div>
          <div>• Preferred lifetime should be less than valid lifetime</div>
          <div>• T1 (renew) should be 50% of preferred lifetime, T2 (rebind) should be 80%</div>
          <div>• Rapid commit reduces DHCP traffic but requires client support</div>
          <div>• Consider prefix delegation for routers and larger deployments</div>
        </div>
      </div>
    </div>
  )
}
