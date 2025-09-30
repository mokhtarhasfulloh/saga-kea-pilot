import { useState, useEffect } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { DnsRecordT, DnsRecordTypeT, DnsRecord } from '../../lib/schemas/dns'
import { DnsValidator } from '../../lib/dnsValidation'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'

interface RecordFormProps {
  zoneName: string
  record?: DnsRecordT | null
  onClose: () => void
  onSuccess: () => void
  toast?: any
}

const RECORD_TYPES: DnsRecordTypeT[] = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT', 'CAA']

export default function RecordForm({ zoneName, record, onClose, onSuccess, toast }: RecordFormProps) {
  const [formData, setFormData] = useState({
    name: record?.name || '',
    type: record?.type || 'A' as DnsRecordTypeT,
    value: record?.value || '',
    ttl: record?.ttl || 300,
    priority: record?.priority || undefined,
    weight: record?.weight || undefined,
    port: record?.port || undefined
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  const isEditing = !!record

  // Real-time validation
  useEffect(() => {
    const validation = DnsValidator.validateRecord({
      name: formData.name,
      type: formData.type,
      value: formData.value,
      ttl: formData.ttl,
      priority: formData.priority,
      weight: formData.weight,
      port: formData.port
    })

    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate with Zod schema
      const recordData = {
        zone: zoneName,
        ...formData
      }
      
      const validatedData = DnsRecord.parse(recordData)

      if (isEditing) {
        await DnsApi.updateRecord(zoneName, record!.name, record!.type, validatedData)
        toast?.success('Record Updated', `${validatedData.type} record "${validatedData.name}" has been updated`)
      } else {
        await DnsApi.createRecord(zoneName, validatedData)
        toast?.success('Record Created', `${validatedData.type} record "${validatedData.name}" has been created`)
      }

      onSuccess()
    } catch (err: any) {
      if (err.issues) {
        // Zod validation error
        setError(err.issues.map((issue: any) => issue.message).join(', '))
      } else {
        setError(err.message || 'Failed to save record')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const requiresPriority = formData.type === 'MX' || formData.type === 'SRV'
  const requiresWeightAndPort = formData.type === 'SRV'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 m-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            {isEditing ? 'Edit DNS Record' : 'Add DNS Record'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Zone</label>
            <Input
              type="text"
              value={zoneName}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="www"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value as DnsRecordTypeT)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {RECORD_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Value</label>
            <Input
              type="text"
              value={formData.value}
              onChange={(e) => handleInputChange('value', e.target.value)}
              placeholder={
                formData.type === 'A' ? '192.168.1.1' :
                formData.type === 'AAAA' ? '2001:db8::1' :
                formData.type === 'CNAME' ? 'example.com' :
                formData.type === 'MX' ? 'mail.example.com' :
                formData.type === 'TXT' ? 'v=spf1 include:_spf.google.com ~all' :
                'Record value'
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">TTL</label>
              <Input
                type="number"
                value={formData.ttl}
                onChange={(e) => handleInputChange('ttl', parseInt(e.target.value))}
                min="1"
                max="2147483647"
                required
              />
            </div>

            {requiresPriority && (
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Input
                  type="number"
                  value={formData.priority || ''}
                  onChange={(e) => handleInputChange('priority', e.target.value ? parseInt(e.target.value) : undefined)}
                  min="0"
                  max="65535"
                  required
                />
              </div>
            )}
          </div>

          {requiresWeightAndPort && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Weight</label>
                <Input
                  type="number"
                  value={formData.weight || ''}
                  onChange={(e) => handleInputChange('weight', e.target.value ? parseInt(e.target.value) : undefined)}
                  min="0"
                  max="65535"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port</label>
                <Input
                  type="number"
                  value={formData.port || ''}
                  onChange={(e) => handleInputChange('port', e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  max="65535"
                  required
                />
              </div>
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-red-800 text-sm font-medium mb-1">Validation Errors:</div>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((err, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-1">•</span>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation warnings */}
          {validationWarnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="text-yellow-800 text-sm font-medium mb-1">Warnings:</div>
              <ul className="text-yellow-700 text-sm space-y-1">
                {validationWarnings.map((warning, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-yellow-500 mr-1">⚠</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* API errors */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-red-800 text-sm font-medium mb-1">Error:</div>
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || validationErrors.length > 0}
              className="flex-1"
            >
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
