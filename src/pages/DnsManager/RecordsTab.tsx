import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { DnsRecordT, DnsRecordTypeT, RecordListResponseT } from '../../lib/schemas/dns'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'
import DnsRecordFilter from '../../components/DnsRecordFilter'
import RecordForm from './RecordForm.tsx'

export default function RecordsTab() {
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [records, setRecords] = useState<DnsRecordT[]>([])
  const [filteredRecords, setFilteredRecords] = useState<DnsRecordT[]>([])
  const [availableZones, setAvailableZones] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DnsRecordT | null>(null)
  const toast = useToast()

  const loadAvailableZones = async () => {
    try {
      const zonesResponse = await DnsApi.getZones()
      const zoneNames = zonesResponse.zones.map(zone => zone.name)
      setAvailableZones(zoneNames)
    } catch (err: any) {
      console.error('Failed to load zones:', err)
    }
  }

  const loadRecords = async (zoneName: string) => {
    if (!zoneName) return

    setLoading(true)
    setError('')
    try {
      const response: RecordListResponseT = await DnsApi.getRecords(zoneName)
      const recordsWithZone = response.records.map(record => ({ ...record, zone: zoneName }))
      setRecords(recordsWithZone)
      setFilteredRecords(recordsWithZone)
    } catch (err: any) {
      setError(err.message || 'Failed to load records')
      console.error('Failed to load records:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedZone) {
      loadRecords(selectedZone)
    }
  }, [selectedZone])

  const handleZoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedZone(e.target.value)
    setRecords([])
    setError('')
  }

  const handleAddRecord = () => {
    setEditingRecord(null)
    setShowForm(true)
  }

  const handleEditRecord = (record: DnsRecordT) => {
    setEditingRecord(record)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingRecord(null)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingRecord(null)
    if (selectedZone) {
      loadRecords(selectedZone)
    }
  }

  const handleDeleteRecord = async (record: DnsRecordT) => {
    if (!confirm(`Delete ${record.type} record "${record.name}"?`)) return

    try {
      await DnsApi.deleteRecord(selectedZone, record.name, record.type)
      toast.success('Record Deleted', `${record.type} record "${record.name}" has been deleted`)
      loadRecords(selectedZone)
    } catch (err: any) {
      toast.error('Delete Failed', err.message || 'Failed to delete record')
    }
  }

  const getRecordTypeColor = (type: DnsRecordTypeT) => {
    const colors: Record<DnsRecordTypeT, string> = {
      'A': 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400',
      'AAAA': 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400',
      'CNAME': 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400',
      'MX': 'bg-orange-100 text-orange-800 dark:bg-orange-950/20 dark:text-orange-400',
      'NS': 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400',
      'PTR': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400',
      'SOA': 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400',
      'SRV': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-400',
      'TXT': 'bg-pink-100 text-pink-800 dark:bg-pink-950/20 dark:text-pink-400',
      'CAA': 'bg-teal-100 text-teal-800 dark:bg-teal-950/20 dark:text-teal-400'
    }
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400'
  }

  useEffect(() => {
    loadAvailableZones()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">DNS Records</h3>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Zone Name</label>
            <Input
              type="text"
              placeholder="example.com"
              value={selectedZone}
              onChange={handleZoneChange}
            />
          </div>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button
              onClick={handleAddRecord}
              disabled={!selectedZone}
              size="sm"
            >
              Add Record
            </Button>
          </RoleGuard>
        </div>
      </Card>

      {error && (
        <Card className="p-4">
          <div className="text-red-600">Error: {error}</div>
        </Card>
      )}

      {loading && (
        <Card className="p-4">
          <div className="text-center text-gray-600">Loading records...</div>
        </Card>
      )}

      {/* Advanced Filtering */}
      {records.length > 0 && (
        <DnsRecordFilter
          records={records}
          onFilteredRecords={setFilteredRecords}
          zones={availableZones}
          className="mb-4"
        />
      )}

      {selectedZone && !loading && records.length === 0 && !error && (
        <Card className="p-8">
          <div className="text-center text-gray-600">
            <div className="text-lg mb-2">No records found</div>
            <div className="text-sm">Add your first DNS record for {selectedZone}</div>
          </div>
        </Card>
      )}

      {filteredRecords.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Value</th>
                  <th className="text-left p-3 font-medium">TTL</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Weight</th>
                  <th className="text-left p-3 font-medium">Port</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={`${record.name}-${record.type}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-mono text-sm">{record.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRecordTypeColor(record.type)}`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-sm max-w-xs truncate" title={record.value}>
                      {record.value}
                    </td>
                    <td className="p-3 font-mono text-sm">{record.ttl}</td>
                    <td className="p-3 font-mono text-sm">
                      {record.priority !== undefined ? record.priority : '-'}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {record.weight !== undefined ? record.weight : '-'}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {record.port !== undefined ? record.port : '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRecord(record)}
                          >
                            Edit
                          </Button>
                        </RoleGuard>
                        <RoleGuard requiredPermission="canDelete" hideIfNoAccess>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRecord(record)}
                          >
                            Delete
                          </Button>
                        </RoleGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <RecordForm
          zoneName={selectedZone}
          record={editingRecord}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          toast={toast}
        />
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
