import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface Reservation6 {
  duid?: string
  'hw-address'?: string
  'ip-addresses'?: string[]
  prefixes?: string[]
  hostname?: string
  'option-data'?: Array<{
    name?: string
    code?: number
    data: string
  }>
}

export default function Reservations6Tab() {
  const [reservations, setReservations] = useState<Reservation6[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation6 | null>(null)
  
  // Form state
  const [identifierType, setIdentifierType] = useState<'duid' | 'hw-address'>('duid')
  const [duid, setDuid] = useState('')
  const [hwAddress, setHwAddress] = useState('')
  const [ipAddresses, setIpAddresses] = useState<string[]>([''])
  const [prefixes, setPrefixes] = useState<string[]>([''])
  const [hostname, setHostname] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}
      setReservations(dhcp6.reservations || [])
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openForm(reservation?: Reservation6) {
    setEditingReservation(reservation || null)
    setIdentifierType(reservation?.duid ? 'duid' : 'hw-address')
    setDuid(reservation?.duid || '')
    setHwAddress(reservation?.['hw-address'] || '')
    setIpAddresses(reservation?.['ip-addresses'] || [''])
    setPrefixes(reservation?.prefixes || [''])
    setHostname(reservation?.hostname || '')
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingReservation(null)
    setIdentifierType('duid')
    setDuid('')
    setHwAddress('')
    setIpAddresses([''])
    setPrefixes([''])
    setHostname('')
    setError('')
  }

  function addIpAddress() {
    setIpAddresses([...ipAddresses, ''])
  }

  function removeIpAddress(index: number) {
    setIpAddresses(ipAddresses.filter((_, i) => i !== index))
  }

  function updateIpAddress(index: number, value: string) {
    const newAddresses = [...ipAddresses]
    newAddresses[index] = value
    setIpAddresses(newAddresses)
  }

  function addPrefix() {
    setPrefixes([...prefixes, ''])
  }

  function removePrefix(index: number) {
    setPrefixes(prefixes.filter((_, i) => i !== index))
  }

  function updatePrefix(index: number, value: string) {
    const newPrefixes = [...prefixes]
    newPrefixes[index] = value
    setPrefixes(newPrefixes)
  }

  function validateForm(): string | null {
    if (identifierType === 'duid') {
      if (!duid.trim()) return 'DUID is required'
      // Basic DUID validation (hex with colons)
      if (!/^[0-9A-Fa-f:]+$/.test(duid)) {
        return 'Invalid DUID format (use hex with colons, e.g., 00:01:00:01:12:34:56:78:00:11:22:33:44:55)'
      }
    } else {
      if (!hwAddress.trim()) return 'MAC address is required'
      // MAC address validation
      if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(hwAddress)) {
        return 'Invalid MAC address format'
      }
    }

    const validIpAddresses = ipAddresses.map(ip => ip.trim()).filter(Boolean)
    const validPrefixes = prefixes.map(p => p.trim()).filter(Boolean)

    if (validIpAddresses.length === 0 && validPrefixes.length === 0) {
      return 'At least one IP address or prefix must be specified'
    }

    // Validate IPv6 addresses
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/
    for (const ip of validIpAddresses) {
      if (!ipv6Regex.test(ip)) {
        return `Invalid IPv6 address: ${ip}`
      }
    }

    // Validate IPv6 prefixes
    const ipv6PrefixRegex = /^(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4}\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/
    for (const prefix of validPrefixes) {
      if (!ipv6PrefixRegex.test(prefix)) {
        return `Invalid IPv6 prefix: ${prefix}`
      }
    }

    return null
  }

  async function saveReservation() {
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

      const reservationData: Reservation6 = {
        ...(identifierType === 'duid' ? { duid: duid.trim() } : { 'hw-address': hwAddress.trim() }),
        ...(hostname.trim() && { hostname: hostname.trim() })
      }

      const validIpAddresses = ipAddresses.map(ip => ip.trim()).filter(Boolean)
      const validPrefixes = prefixes.map(p => p.trim()).filter(Boolean)

      if (validIpAddresses.length > 0) {
        reservationData['ip-addresses'] = validIpAddresses
      }

      if (validPrefixes.length > 0) {
        reservationData.prefixes = validPrefixes
      }

      let updatedReservations = [...(dhcp6.reservations || [])]
      
      if (editingReservation) {
        const index = updatedReservations.findIndex(res => 
          (res.duid === editingReservation.duid && res.duid) ||
          (res['hw-address'] === editingReservation['hw-address'] && res['hw-address'])
        )
        if (index >= 0) {
          updatedReservations[index] = reservationData
        }
      } else {
        updatedReservations.push(reservationData)
      }

      const updatedConfig = {
        ...dhcp6,
        reservations: updatedReservations
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

  async function deleteReservation(reservation: Reservation6) {
    const identifier = reservation.duid || reservation['hw-address']
    if (!confirm(`Delete reservation for ${identifier}?`)) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const updatedReservations = (dhcp6.reservations || []).filter((res: any) =>
        !((res.duid === reservation.duid && res.duid) ||
          (res['hw-address'] === reservation['hw-address'] && res['hw-address']))
      )

      const updatedConfig = {
        ...dhcp6,
        reservations: updatedReservations
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
        <div className="text-gray-500">Loading IPv6 reservations...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">IPv6 Host Reservations</h2>
          <p className="text-sm text-gray-600">
            Reserve specific IPv6 addresses and prefixes for known clients
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Add Reservation
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configured Reservations</h3>
        </CardHeader>
        <CardContent>
          {reservations.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Identifier</Th>
                  <Th>Type</Th>
                  <Th>IP Addresses</Th>
                  <Th>Prefixes</Th>
                  <Th>Hostname</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {reservations.map((reservation, i) => (
                  <Tr key={i}>
                    <Td className="font-mono text-xs">
                      {reservation.duid || reservation['hw-address']}
                    </Td>
                    <Td>
                      {reservation.duid ? (
                        <span className="text-blue-600">DUID</span>
                      ) : (
                        <span className="text-green-600">MAC</span>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">
                      {reservation['ip-addresses']?.join(', ') || 'None'}
                    </Td>
                    <Td className="font-mono text-xs">
                      {reservation.prefixes?.join(', ') || 'None'}
                    </Td>
                    <Td>{reservation.hostname || 'N/A'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openForm(reservation)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteReservation(reservation)}
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
              <div className="text-lg mb-2">No IPv6 reservations configured</div>
              <div className="text-sm">Add a reservation to assign specific addresses to known clients</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reservation Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingReservation ? 'Edit' : 'Add'} IPv6 Reservation
            </h3>

            <div className="space-y-4">
              {/* Identifier Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Identifier Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="identifierType"
                      value="duid"
                      checked={identifierType === 'duid'}
                      onChange={() => setIdentifierType('duid')}
                      disabled={saving}
                    />
                    <span className="text-sm">DUID (Recommended)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="identifierType"
                      value="hw-address"
                      checked={identifierType === 'hw-address'}
                      onChange={() => setIdentifierType('hw-address')}
                      disabled={saving}
                    />
                    <span className="text-sm">MAC Address</span>
                  </label>
                </div>
              </div>

              {/* Identifier Value */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {identifierType === 'duid' ? 'DUID *' : 'MAC Address *'}
                </label>
                <Input
                  value={identifierType === 'duid' ? duid : hwAddress}
                  onChange={e => identifierType === 'duid' ? setDuid(e.target.value) : setHwAddress(e.target.value)}
                  placeholder={
                    identifierType === 'duid' 
                      ? '00:01:00:01:12:34:56:78:00:11:22:33:44:55'
                      : '00:11:22:33:44:55'
                  }
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {identifierType === 'duid' 
                    ? 'DHCP Unique Identifier (hex with colons)'
                    : 'MAC address of the client interface'
                  }
                </div>
              </div>

              {/* Hostname */}
              <div>
                <label className="block text-sm font-medium mb-1">Hostname (Optional)</label>
                <Input
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  placeholder="client-hostname"
                  disabled={saving}
                />
              </div>

              {/* IP Addresses */}
              <div>
                <label className="block text-sm font-medium mb-1">Reserved IPv6 Addresses</label>
                <div className="space-y-2">
                  {ipAddresses.map((ip, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={ip}
                        onChange={e => updateIpAddress(i, e.target.value)}
                        placeholder="2001:db8::100"
                        disabled={saving}
                      />
                      {ipAddresses.length > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => removeIpAddress(i)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addIpAddress}
                    disabled={saving}
                  >
                    Add IP Address
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Specific IPv6 addresses to reserve for this client
                </div>
              </div>

              {/* Prefixes */}
              <div>
                <label className="block text-sm font-medium mb-1">Reserved IPv6 Prefixes</label>
                <div className="space-y-2">
                  {prefixes.map((prefix, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={prefix}
                        onChange={e => updatePrefix(i, e.target.value)}
                        placeholder="2001:db8:1000::/64"
                        disabled={saving}
                      />
                      {prefixes.length > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => removePrefix(i)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addPrefix}
                    disabled={saving}
                  >
                    Add Prefix
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  IPv6 prefixes to delegate to this client (for routers)
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveReservation} disabled={saving}>
                {saving ? 'Saving...' : 'Save Reservation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IPv6 Reservation Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">IPv6 Reservation Guidelines</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>DUID vs MAC:</strong> DUID is preferred as it's more stable across network changes</div>
          <div>• <strong>Address Reservations:</strong> Use for servers, printers, and infrastructure devices</div>
          <div>• <strong>Prefix Reservations:</strong> Use for routers that need consistent delegated prefixes</div>
          <div>• <strong>Mixed Reservations:</strong> A client can have both address and prefix reservations</div>
          <div>• <strong>DUID Format:</strong> Usually starts with type (00:01 for LLT, 00:03 for LL)</div>
        </div>
      </div>
    </div>
  )
}
