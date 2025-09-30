import { useState, useEffect } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Tbody, Tr, Td } from '../../components/ui/table'

interface Lease {
  'ip-address'?: string
  'hw-address'?: string
  'client-id'?: string
  hostname?: string
  state?: number
  'valid-lft'?: number
  'cltt'?: number
  'subnet-id'?: number
  'fqdn-fwd'?: boolean
  'fqdn-rev'?: boolean
}

interface Statistics {
  'pkt4-received'?: number
  'pkt4-discover-received'?: number
  'pkt4-offer-sent'?: number
  'pkt4-request-received'?: number
  'pkt4-ack-sent'?: number
  'pkt4-nak-sent'?: number
  'pkt4-release-received'?: number
  'pkt4-decline-received'?: number
  'declined-addresses'?: number
}

export default function LeaseOperationsTab() {
  const [searchType, setSearchType] = useState<'ip' | 'mac' | 'client-id'>('ip')
  const [searchValue, setSearchValue] = useState('')
  const [foundLease, setFoundLease] = useState<Lease | null>(null)
  const [statistics, setStatistics] = useState<Statistics>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [operating, setOperating] = useState(false)

  async function searchLease() {
    if (!searchValue.trim()) {
      setError('Please enter a search value')
      return
    }

    setLoading(true)
    setError('')
    setFoundLease(null)

    try {
      let result
      switch (searchType) {
        case 'ip':
          result = await Kea.actionDhcp4('lease4-get', { 'ip-address': searchValue.trim() })
          break
        case 'mac':
          result = await Kea.actionDhcp4('lease4-get-by-hw-address', { 'hw-address': searchValue.trim() })
          break
        case 'client-id':
          result = await Kea.actionDhcp4('lease4-get-by-client-id', { 'client-id': searchValue.trim() })
          break
      }

      if (result.result === 0 && result.arguments) {
        setFoundLease(result.arguments)
      } else if (result.result === 3) {
        setError('No lease found for the specified criteria')
      } else {
        setError(result.text || 'Failed to search for lease')
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadStatistics() {
    try {
      const stats = await Kea.actionDhcp4('statistic-get-all', {})
      if (stats.result === 0 && stats.arguments) {
        setStatistics(stats.arguments)
      }
    } catch (e: any) {
      console.error('Failed to load statistics:', e)
    }
  }

  useEffect(() => {
    loadStatistics()
  }, [])

  async function releaseLease() {
    if (!foundLease?.['ip-address']) return

    if (!confirm(`Force release lease for ${foundLease['ip-address']}? This will immediately free the address.`)) {
      return
    }

    setOperating(true)
    setError('')

    try {
      const result = await Kea.actionDhcp4('lease4-del', {
        'ip-address': foundLease['ip-address']
      })

      if (result.result === 0) {
        setFoundLease(null)
        setSearchValue('')
        await loadStatistics()
      } else {
        setError(result.text || 'Failed to release lease')
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setOperating(false)
    }
  }

  async function reclaimLeases() {
    if (!confirm('Trigger lease reclamation? This will process expired leases and may take some time.')) {
      return
    }

    setOperating(true)
    setError('')

    try {
      const result = await Kea.actionDhcp4('leases-reclaim', { remove: true })
      
      if (result.result === 0) {
        await loadStatistics()
        alert(`Lease reclamation completed. Processed leases: ${result.text || 'Unknown'}`)
      } else {
        setError(result.text || 'Failed to reclaim leases')
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setOperating(false)
    }
  }

  function getLeaseStateText(state?: number): string {
    switch (state) {
      case 0: return 'Default'
      case 1: return 'Declined'
      case 2: return 'Expired-Reclaimed'
      case 3: return 'Released'
      case 4: return 'Backup'
      default: return 'Unknown'
    }
  }

  function getLeaseStateColor(state?: number): string {
    switch (state) {
      case 0: return 'text-green-600'
      case 1: return 'text-red-600'
      case 2: return 'text-gray-600'
      case 3: return 'text-blue-600'
      case 4: return 'text-yellow-600'
      default: return 'text-gray-400'
    }
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleString()
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Lease Operations</h2>
        <p className="text-sm text-gray-600">
          Search, manage, and monitor DHCP leases with advanced operations
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Lease Search */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Lease Search & Lookup</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Search Type</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={searchType}
                onChange={e => setSearchType(e.target.value as any)}
                disabled={loading}
              >
                <option value="ip">IP Address</option>
                <option value="mac">MAC Address</option>
                <option value="client-id">Client ID</option>
              </select>
            </div>
            <div className="flex-2">
              <label className="block text-sm font-medium mb-1">Search Value</label>
              <Input
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder={
                  searchType === 'ip' ? '192.168.1.100' :
                  searchType === 'mac' ? '00:11:22:33:44:55' :
                  '01:00:11:22:33:44:55'
                }
                disabled={loading}
                onKeyPress={e => e.key === 'Enter' && searchLease()}
              />
            </div>
            <Button onClick={searchLease} disabled={loading || !searchValue.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Lease Details */}
          {foundLease && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">Lease Details</h4>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={releaseLease}
                    disabled={operating}
                  >
                    Force Release
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Table>
                    <Tbody>
                      <Tr>
                        <Td className="font-medium">IP Address</Td>
                        <Td className="font-mono">{foundLease['ip-address']}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">MAC Address</Td>
                        <Td className="font-mono">{foundLease['hw-address'] || 'N/A'}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">Client ID</Td>
                        <Td className="font-mono">{foundLease['client-id'] || 'N/A'}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">Hostname</Td>
                        <Td>{foundLease.hostname || 'N/A'}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">Subnet ID</Td>
                        <Td>{foundLease['subnet-id'] || 'N/A'}</Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </div>
                <div>
                  <Table>
                    <Tbody>
                      <Tr>
                        <Td className="font-medium">State</Td>
                        <Td>
                          <span className={getLeaseStateColor(foundLease.state)}>
                            {getLeaseStateText(foundLease.state)}
                          </span>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">Valid Lifetime</Td>
                        <Td>{formatDuration(foundLease['valid-lft'])}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">Last Transaction</Td>
                        <Td>{formatTimestamp(foundLease.cltt)}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">FQDN Forward</Td>
                        <Td>{foundLease['fqdn-fwd'] ? 'Yes' : 'No'}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">FQDN Reverse</Td>
                        <Td>{foundLease['fqdn-rev'] ? 'Yes' : 'No'}</Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Statistics */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Server Statistics</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStatistics}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {statistics['pkt4-received'] || 0}
              </div>
              <div className="text-sm text-gray-600">Packets Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {statistics['pkt4-ack-sent'] || 0}
              </div>
              <div className="text-sm text-gray-600">ACKs Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {statistics['pkt4-nak-sent'] || 0}
              </div>
              <div className="text-sm text-gray-600">NAKs Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {statistics['declined-addresses'] || 0}
              </div>
              <div className="text-sm text-gray-600">Declined Addresses</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Bulk Operations</h3>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={reclaimLeases}
              disabled={operating}
              variant="outline"
            >
              {operating ? 'Processing...' : 'Reclaim Expired Leases'}
            </Button>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Lease reclamation processes expired leases and frees up addresses that are no longer in use.
          </div>
        </CardContent>
      </Card>

      {/* Usage Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Lease Operations Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Force Release:</strong> Immediately frees a lease, making the IP available for reassignment</div>
          <div>• <strong>Declined Addresses:</strong> IPs that clients rejected due to conflicts or other issues</div>
          <div>• <strong>NAK Responses:</strong> Negative acknowledgments sent when requests cannot be fulfilled</div>
          <div>• <strong>Lease Reclamation:</strong> Automated cleanup of expired leases to free resources</div>
        </div>
      </div>
    </div>
  )
}
