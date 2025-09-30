import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface SharedNetwork {
  name: string
  subnet4: Array<{
    id?: number
    subnet: string
    pools?: Array<{ pool: string }>
  }>
  'option-data'?: Array<{
    name?: string
    code?: number
    data: string
  }>
  relay?: {
    'ip-addresses': string[]
  }
}

interface Subnet {
  id?: number
  subnet: string
  pools?: Array<{ pool: string }>
  'shared-network-name'?: string
}

export default function SharedNetworksTab() {
  const [sharedNetworks, setSharedNetworks] = useState<SharedNetwork[]>([])
  const [availableSubnets, setAvailableSubnets] = useState<Subnet[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingNetwork, setEditingNetwork] = useState<SharedNetwork | null>(null)
  const [networkName, setNetworkName] = useState('')
  const [selectedSubnets, setSelectedSubnets] = useState<number[]>([])
  const [relayAddresses, setRelayAddresses] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || config
      
      setSharedNetworks(dhcp4['shared-networks'] || [])
      setAvailableSubnets(dhcp4.subnet4 || [])
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openForm(network?: SharedNetwork) {
    setEditingNetwork(network || null)
    setNetworkName(network?.name || '')
    setSelectedSubnets(network?.subnet4?.map(s => s.id || 0).filter(id => id > 0) || [])
    setRelayAddresses(network?.relay?.['ip-addresses']?.join(', ') || '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingNetwork(null)
    setNetworkName('')
    setSelectedSubnets([])
    setRelayAddresses('')
  }

  async function saveNetwork() {
    if (!networkName.trim()) {
      setError('Network name is required')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || config
      
      // Get selected subnet objects
      const networkSubnets = availableSubnets.filter(s => 
        selectedSubnets.includes(s.id || 0)
      )

      const newNetwork: SharedNetwork = {
        name: networkName,
        subnet4: networkSubnets,
        ...(relayAddresses.trim() && {
          relay: {
            'ip-addresses': relayAddresses.split(',').map(ip => ip.trim()).filter(Boolean)
          }
        })
      }

      // Update shared networks
      let updatedNetworks = [...(dhcp4['shared-networks'] || [])]
      
      if (editingNetwork) {
        const index = updatedNetworks.findIndex(n => n.name === editingNetwork.name)
        if (index >= 0) {
          updatedNetworks[index] = newNetwork
        }
      } else {
        updatedNetworks.push(newNetwork)
      }

      // Remove selected subnets from standalone subnet4 array
      const remainingSubnets = (dhcp4.subnet4 || []).filter((s: any) =>
        !selectedSubnets.includes(s.id || 0)
      )

      const updatedConfig = {
        ...dhcp4,
        'shared-networks': updatedNetworks,
        subnet4: remainingSubnets
      }

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')
      
      closeForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function deleteNetwork(networkName: string) {
    if (!confirm(`Delete shared network "${networkName}"? Subnets will be moved back to standalone.`)) {
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || config
      
      const networkToDelete = sharedNetworks.find(n => n.name === networkName)
      if (!networkToDelete) return

      // Remove network from shared-networks
      const updatedNetworks = (dhcp4['shared-networks'] || []).filter((n: any) => n.name !== networkName)
      
      // Move subnets back to standalone subnet4 array
      const updatedSubnets = [...(dhcp4.subnet4 || []), ...networkToDelete.subnet4]

      const updatedConfig = {
        ...dhcp4,
        'shared-networks': updatedNetworks,
        subnet4: updatedSubnets
      }

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')
      
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const unassignedSubnets = availableSubnets.filter(s => 
    !sharedNetworks.some(n => n.subnet4.some(ns => ns.id === s.id))
  )

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Shared Networks</h2>
          <p className="text-sm text-gray-600">
            Group subnets that share the same physical network segment
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={loading}>
          Add Shared Network
        </Button>
      </div>

      {/* Shared Networks List */}
      <div className="space-y-3">
        {sharedNetworks.map((network, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{network.name}</h3>
                  <div className="text-sm text-gray-600">
                    {network.subnet4.length} subnet{network.subnet4.length !== 1 ? 's' : ''}
                    {network.relay?.['ip-addresses']?.length && (
                      <span className="ml-2 text-blue-600">
                        • Relayed via {network.relay['ip-addresses'].join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openForm(network)}
                    disabled={loading}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => deleteNetwork(network.name)}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Subnet ID</Th>
                    <Th>Network</Th>
                    <Th>Pools</Th>
                    <Th>Traffic Type</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {network.subnet4.map((subnet, j) => (
                    <Tr key={j}>
                      <Td>{subnet.id || 'N/A'}</Td>
                      <Td className="font-mono">{subnet.subnet}</Td>
                      <Td>
                        {subnet.pools?.map(p => p.pool).join(', ') || 'No pools'}
                      </Td>
                      <Td>
                        <span className={`px-2 py-1 rounded text-xs ${
                          network.relay?.['ip-addresses']?.length 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {network.relay?.['ip-addresses']?.length ? 'Relayed' : 'Local'}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardContent>
          </Card>
        ))}
        
        {sharedNetworks.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <div className="text-gray-500">
                <div className="text-lg mb-2">No shared networks configured</div>
                <div className="text-sm">Create a shared network to group subnets on the same physical segment</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingNetwork ? 'Edit' : 'Create'} Shared Network
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Network Name</label>
                <Input
                  value={networkName}
                  onChange={e => setNetworkName(e.target.value)}
                  placeholder="e.g., office-network"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subnets ({selectedSubnets.length} selected)
                </label>
                <div className="border rounded p-3 max-h-48 overflow-y-auto space-y-2">
                  {unassignedSubnets.map(subnet => (
                    <label key={subnet.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedSubnets.includes(subnet.id || 0)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSubnets([...selectedSubnets, subnet.id || 0])
                          } else {
                            setSelectedSubnets(selectedSubnets.filter(id => id !== subnet.id))
                          }
                        }}
                        disabled={loading}
                      />
                      <span className="text-sm">
                        ID {subnet.id}: {subnet.subnet}
                      </span>
                    </label>
                  ))}
                  {editingNetwork?.subnet4.map(subnet => (
                    <label key={`edit-${subnet.id}`} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedSubnets.includes(subnet.id || 0)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSubnets([...selectedSubnets, subnet.id || 0])
                          } else {
                            setSelectedSubnets(selectedSubnets.filter(id => id !== subnet.id))
                          }
                        }}
                        disabled={loading}
                      />
                      <span className="text-sm">
                        ID {subnet.id}: {subnet.subnet} (currently in network)
                      </span>
                    </label>
                  ))}
                  {unassignedSubnets.length === 0 && !editingNetwork && (
                    <div className="text-sm text-gray-500">No unassigned subnets available</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Relay Addresses (optional)
                </label>
                <Input
                  value={relayAddresses}
                  onChange={e => setRelayAddresses(e.target.value)}
                  placeholder="10.0.1.1, 10.0.2.1"
                  disabled={loading}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Comma-separated IP addresses of DHCP relay agents
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={saveNetwork} disabled={loading || !networkName.trim()}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
