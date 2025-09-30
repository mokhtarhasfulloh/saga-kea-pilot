import { useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
// import { DnsRecordT } from '../../lib/schemas/dns'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'

export default function BulkOperationsTab() {
  const [selectedZone, setSelectedZone] = useState('')
  const [operation, setOperation] = useState<'create' | 'update' | 'delete' | 'import' | 'export'>('create')
  const [bulkData, setBulkData] = useState('')
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const toast = useToast()

  const handleBulkOperation = async () => {
    if (!selectedZone.trim()) {
      toast.error('Validation Error', 'Please select a zone')
      return
    }

    setProcessing(true)
    setResults(null)

    try {
      let result
      
      if (operation === 'import') {
        if (!bulkData.trim()) {
          toast.error('Validation Error', 'Please provide zone file content to import')
          return
        }
        result = await DnsApi.importRecords(selectedZone, bulkData)
        toast.success('Import Completed', result.message || 'Records imported successfully')
      } else if (operation === 'export') {
        const format = 'bind' // Could be made configurable
        result = await DnsApi.exportRecords(selectedZone, format)
        
        if (format === 'bind') {
          // For BIND format, result is the zone file content
          setBulkData(result)
          toast.success('Export Completed', 'Zone file exported successfully')
        } else {
          setBulkData(JSON.stringify(result, null, 2))
          toast.success('Export Completed', 'Records exported successfully')
        }
      } else {
        // Parse JSON records for create/update/delete operations
        let records
        try {
          records = JSON.parse(bulkData)
          if (!Array.isArray(records)) {
            throw new Error('Records must be an array')
          }
        } catch (error) {
          toast.error('Parse Error', 'Invalid JSON format for records')
          return
        }

        if (records.length === 0) {
          toast.error('Validation Error', 'No records provided')
          return
        }

        if (records.length > 100) {
          toast.error('Validation Error', 'Maximum 100 records allowed per operation')
          return
        }

        switch (operation) {
          case 'create':
            result = await DnsApi.bulkCreateRecords(selectedZone, records)
            break
          case 'update':
            result = await DnsApi.bulkUpdateRecords(selectedZone, records)
            break
          case 'delete':
            result = await DnsApi.bulkDeleteRecords(selectedZone, records)
            break
        }

        toast.success('Operation Completed', result.message || `Bulk ${operation} completed successfully`)
      }

      setResults(result)
    } catch (error: any) {
      toast.error('Operation Failed', error.message || `Failed to ${operation} records`)
    } finally {
      setProcessing(false)
    }
  }

  const getPlaceholderText = () => {
    switch (operation) {
      case 'import':
        return `; Zone file content for import
; Example:
$TTL 300
@       IN      SOA     ns1.example.com. admin.example.com. (
                        2024010101      ; Serial
                        3600           ; Refresh
                        1800           ; Retry
                        604800         ; Expire
                        86400 )        ; Minimum TTL

@       IN      NS      ns1.example.com.
@       IN      A       192.168.1.1
www     IN      A       192.168.1.2
mail    IN      A       192.168.1.3
@       IN      MX      10 mail.example.com.`
      case 'export':
        return 'Exported zone file content will appear here...'
      case 'create':
        return `[
  {
    "name": "www",
    "type": "A",
    "value": "192.168.1.1",
    "ttl": 300
  },
  {
    "name": "mail",
    "type": "A", 
    "value": "192.168.1.2",
    "ttl": 300
  }
]`
      case 'update':
        return `[
  {
    "name": "www",
    "type": "A",
    "value": "192.168.1.10",
    "ttl": 600
  }
]`
      case 'delete':
        return `[
  {
    "name": "old-record",
    "type": "A"
  },
  {
    "name": "temp",
    "type": "CNAME"
  }
]`
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Bulk DNS Operations</h3>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {/* Zone Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Target Zone *</label>
            <input
              type="text"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Operation Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Operation Type</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="create">Bulk Create Records</option>
              <option value="update">Bulk Update Records</option>
              <option value="delete">Bulk Delete Records</option>
              <option value="import">Import Zone File</option>
              <option value="export">Export Zone File</option>
            </select>
          </div>

          {/* Data Input */}
          {operation !== 'export' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {operation === 'import' ? 'Zone File Content' : 'Records JSON'}
                {operation !== 'import' && ' (Array of record objects)'}
              </label>
              <textarea
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                placeholder={getPlaceholderText()}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}

          {/* Export Results */}
          {operation === 'export' && bulkData && (
            <div>
              <label className="block text-sm font-medium mb-2">Exported Zone File</label>
              <textarea
                value={bulkData}
                readOnly
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([bulkData], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${selectedZone}.zone`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  Download Zone File
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
              <Button
                onClick={handleBulkOperation}
                disabled={processing || !selectedZone.trim() || (operation !== 'export' && !bulkData.trim())}
                className="flex-1"
              >
                {processing ? 'Processing...' : `${operation.charAt(0).toUpperCase() + operation.slice(1)} Records`}
              </Button>
            </RoleGuard>
            
            {bulkData && (
              <Button
                variant="outline"
                onClick={() => setBulkData('')}
                className="flex-1"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results Display */}
      {results && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-4">Operation Results</h4>
          <div className="space-y-2">
            {results.results && (
              <>
                <div className="text-sm">
                  <span className="text-green-600 font-medium">Successful: {results.results.success}</span>
                  {results.results.failed > 0 && (
                    <span className="text-red-600 font-medium ml-4">Failed: {results.results.failed}</span>
                  )}
                </div>
                
                {results.results.errors && results.results.errors.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-red-600 mb-2">Errors:</h5>
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      {results.results.errors.map((error: string, index: number) => (
                        <div key={index} className="text-sm text-red-700">{error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {results.imported !== undefined && (
              <div className="text-sm">
                <span className="text-green-600 font-medium">Imported: {results.imported}</span>
                {results.failed > 0 && (
                  <span className="text-red-600 font-medium ml-4">Failed: {results.failed}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
