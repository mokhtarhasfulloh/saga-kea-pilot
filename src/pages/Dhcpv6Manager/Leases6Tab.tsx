import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import Select from '../../components/ui/select'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface Lease6 {
  'ip-address'?: string
  duid?: string
  'valid-lft'?: number
  'cltt'?: number
  'subnet-id'?: number
  'pref-lft'?: number
  'lease-type'?: 'IA_NA' | 'IA_TA' | 'IA_PD'
  iaid?: number
  'prefix-len'?: number
  hostname?: string
  'fqdn-fwd'?: boolean
  'fqdn-rev'?: boolean
  state?: number
}

interface LeaseSearchParams {
  'subnet-id'?: number
  'ip-address'?: string
  duid?: string
  'lease-type'?: string
  from?: string
  size?: number
}

export default function Leases6Tab() {
  const [leases, setLeases] = useState<Lease6[]>([])
  const [totalLeases, setTotalLeases] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchParams, setSearchParams] = useState<LeaseSearchParams>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // const [sortBy, setSortBy] = useState<'ip-address' | 'cltt' | 'valid-lft'>('cltt')
  // const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Search form state
  const [searchSubnetId, setSearchSubnetId] = useState('')
  const [searchIpAddress, setSearchIpAddress] = useState('')
  const [searchDuid, setSearchDuid] = useState('')
  const [searchLeaseType, setSearchLeaseType] = useState('')

  async function loadLeases() {
    setLoading(true)
    setError('')
    try {
      // Build search parameters
      const params: LeaseSearchParams = {
        size: pageSize,
        from: ((currentPage - 1) * pageSize).toString(),
        ...(searchParams['subnet-id'] && { 'subnet-id': searchParams['subnet-id'] }),
        ...(searchParams['ip-address'] && { 'ip-address': searchParams['ip-address'] }),
        ...(searchParams.duid && { duid: searchParams.duid }),
        ...(searchParams['lease-type'] && { 'lease-type': searchParams['lease-type'] })
      }

      // Use lease6-get-page for pagination
      const result = await Kea.actionDhcp6('lease6-get-page', params)
      
      if (result.result === 0 && result.arguments) {
        const leaseData = result.arguments.leases || []
        setLeases(leaseData)
        setTotalLeases(result.arguments.count || leaseData.length)
      } else {
        setLeases([])
        setTotalLeases(0)
      }
    } catch (e: any) {
      setError(String(e))
      setLeases([])
      setTotalLeases(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeases()
  }, [currentPage, pageSize, searchParams])

  function handleSearch() {
    const newParams: LeaseSearchParams = {}
    
    if (searchSubnetId.trim()) {
      newParams['subnet-id'] = parseInt(searchSubnetId.trim())
    }
    if (searchIpAddress.trim()) {
      newParams['ip-address'] = searchIpAddress.trim()
    }
    if (searchDuid.trim()) {
      newParams.duid = searchDuid.trim()
    }
    if (searchLeaseType.trim()) {
      newParams['lease-type'] = searchLeaseType.trim()
    }

    setSearchParams(newParams)
    setCurrentPage(1)
  }

  function clearSearch() {
    setSearchParams({})
    setSearchSubnetId('')
    setSearchIpAddress('')
    setSearchDuid('')
    setSearchLeaseType('')
    setCurrentPage(1)
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
      case 0: return 'text-green-600 dark:text-green-400'
      case 1: return 'text-red-600 dark:text-red-400'
      case 2: return 'text-gray-600 dark:text-gray-400'
      case 3: return 'text-blue-600 dark:text-blue-400'
      case 4: return 'text-yellow-600 dark:text-yellow-400'
      default: return 'text-gray-400 dark:text-gray-500'
    }
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleString()
  }

  // function formatDuration(seconds?: number): string {
  //   if (!seconds) return 'N/A'
  //   const hours = Math.floor(seconds / 3600)
  //   const minutes = Math.floor((seconds % 3600) / 60)
  //   const secs = seconds % 60
  //   return `${hours}h ${minutes}m ${secs}s`
  // }

  function formatDuid(duid?: string): string {
    if (!duid) return 'N/A'
    // Truncate long DUIDs for display
    return duid.length > 20 ? `${duid.substring(0, 20)}...` : duid
  }

  const totalPages = Math.ceil(totalLeases / pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalLeases)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">IPv6 Leases</h2>
        <p className="text-sm text-gray-600">
          View and manage active DHCPv6 leases with search and pagination
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Search Leases</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Subnet ID</label>
              <Input
                value={searchSubnetId}
                onChange={e => setSearchSubnetId(e.target.value)}
                placeholder="1"
                type="number"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IPv6 Address</label>
              <Input
                value={searchIpAddress}
                onChange={e => setSearchIpAddress(e.target.value)}
                placeholder="2001:db8::100"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">DUID</label>
              <Input
                value={searchDuid}
                onChange={e => setSearchDuid(e.target.value)}
                placeholder="00:01:00:01:..."
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lease Type</label>
              <Select
                value={searchLeaseType}
                onChange={e => setSearchLeaseType(e.target.value)}
                disabled={loading}
              >
                <option value="">All Types</option>
                <option value="IA_NA">IA_NA (Non-temporary)</option>
                <option value="IA_TA">IA_TA (Temporary)</option>
                <option value="IA_PD">IA_PD (Prefix Delegation)</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              Search
            </Button>
            <Button variant="outline" onClick={clearSearch} disabled={loading}>
              Clear
            </Button>
            <Button variant="outline" onClick={loadLeases} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex}-{endIndex} of {totalLeases} leases
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Page size:</span>
          <Select
            className="text-sm"
            value={pageSize}
            onChange={e => {
              setPageSize(parseInt(e.target.value))
              setCurrentPage(1)
            }}
            disabled={loading}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </Select>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={loading || currentPage <= 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={loading || currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Leases Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">IPv6 Leases</h3>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading leases...</div>
            </div>
          ) : leases.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>IPv6 Address/Prefix</Th>
                  <Th>DUID</Th>
                  <Th>Type</Th>
                  <Th>Subnet</Th>
                  <Th>State</Th>
                  <Th>Valid Until</Th>
                  <Th>Preferred Until</Th>
                  <Th>Hostname</Th>
                </Tr>
              </Thead>
              <Tbody>
                {leases.map((lease, i) => (
                  <Tr key={i}>
                    <Td className="font-mono text-xs">
                      {lease['ip-address']}
                      {lease['prefix-len'] && `/${lease['prefix-len']}`}
                    </Td>
                    <Td className="font-mono text-xs" title={lease.duid}>
                      {formatDuid(lease.duid)}
                    </Td>
                    <Td>
                      <span className={`text-xs px-2 py-1 rounded ${
                        lease['lease-type'] === 'IA_NA' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400' :
                        lease['lease-type'] === 'IA_TA' ? 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400' :
                        lease['lease-type'] === 'IA_PD' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400'
                      }`}>
                        {lease['lease-type'] || 'Unknown'}
                      </span>
                    </Td>
                    <Td>{lease['subnet-id'] || 'N/A'}</Td>
                    <Td>
                      <span className={getLeaseStateColor(lease.state)}>
                        {getLeaseStateText(lease.state)}
                      </span>
                    </Td>
                    <Td className="text-xs">
                      {lease['valid-lft'] && lease.cltt ? 
                        formatTimestamp(lease.cltt + lease['valid-lft']) : 'N/A'}
                    </Td>
                    <Td className="text-xs">
                      {lease['pref-lft'] && lease.cltt ? 
                        formatTimestamp(lease.cltt + lease['pref-lft']) : 'N/A'}
                    </Td>
                    <Td>{lease.hostname || 'N/A'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-lg mb-2">No IPv6 leases found</div>
              <div className="text-sm">
                {Object.keys(searchParams).length > 0
                  ? 'Try adjusting your search criteria'
                  : 'No active DHCPv6 leases in the system'
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lease Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center py-4">
            <div className="text-2xl font-bold text-blue-600">{totalLeases}</div>
            <div className="text-sm text-gray-600">Total Leases</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-4">
            <div className="text-2xl font-bold text-green-600">
              {leases.filter(l => l.state === 0).length}
            </div>
            <div className="text-sm text-gray-600">Active Leases</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center py-4">
            <div className="text-2xl font-bold text-purple-600">
              {leases.filter(l => l['lease-type'] === 'IA_PD').length}
            </div>
            <div className="text-sm text-gray-600">Prefix Delegations</div>
          </CardContent>
        </Card>
      </div>

      {/* IPv6 Lease Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">IPv6 Lease Types</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>IA_NA:</strong> Identity Association for Non-temporary Addresses (standard addresses)</div>
          <div>• <strong>IA_TA:</strong> Identity Association for Temporary Addresses (privacy addresses)</div>
          <div>• <strong>IA_PD:</strong> Identity Association for Prefix Delegation (delegated prefixes)</div>
          <div>• <strong>DUID:</strong> DHCP Unique Identifier, more stable than MAC addresses</div>
          <div>• <strong>Preferred vs Valid:</strong> Preferred lifetime is when address becomes deprecated</div>
        </div>
      </div>
    </div>
  )
}
