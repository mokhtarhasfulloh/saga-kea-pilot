import { useState } from 'react'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface BulkOperation {
  id: string
  type: string
  description: string
  targets: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  started: string
  completed?: string
  results?: {
    success: number
    failed: number
    skipped: number
  }
  error?: string
}

interface BulkOperationField {
  name: string
  label: string
  type: 'number' | 'text' | 'select' | 'checkbox'
  default?: any
  options?: string[]
}

const BULK_OPERATION_TEMPLATES: Array<{
  type: string
  name: string
  description: string
  fields: BulkOperationField[]
}> = [
  {
    type: 'subnet-update' as const,
    name: 'Update Subnet Lease Times',
    description: 'Bulk update lease times across multiple subnets',
    fields: [
      { name: 'valid-lifetime', label: 'Valid Lifetime (seconds)', type: 'number', default: 7200 },
      { name: 'preferred-lifetime', label: 'Preferred Lifetime (seconds)', type: 'number', default: 3600 }
    ]
  },
  {
    type: 'option-assign' as const,
    name: 'Assign Options to Subnets',
    description: 'Bulk assign DHCP options to multiple subnets',
    fields: [
      { name: 'option-set', label: 'Option Set', type: 'select', options: ['Basic DHCP', 'PXE Boot', 'VoIP'] },
      { name: 'override', label: 'Override Existing', type: 'checkbox', default: false }
    ]
  },
  {
    type: 'lease-cleanup' as const,
    name: 'Cleanup Expired Leases',
    description: 'Remove expired leases older than specified days',
    fields: [
      { name: 'days', label: 'Days Old', type: 'number', default: 30 },
      { name: 'dry-run', label: 'Dry Run (preview only)', type: 'checkbox', default: true }
    ]
  },
  {
    type: 'reservation-update' as const,
    name: 'Update Reservations',
    description: 'Bulk update host reservation properties',
    fields: [
      { name: 'property', label: 'Property to Update', type: 'select', options: ['hostname', 'options', 'ip-address'] },
      { name: 'value', label: 'New Value', type: 'text', default: '' }
    ]
  }
]

export default function BulkOperationsTab() {
  const [operations, setOperations] = useState<BulkOperation[]>([
    {
      id: 'op-1',
      type: 'subnet-update',
      description: 'Updated lease times for production subnets',
      targets: ['192.168.1.0/24', '192.168.2.0/24', '192.168.3.0/24'],
      status: 'completed',
      progress: 100,
      started: '2024-01-20T10:00:00Z',
      completed: '2024-01-20T10:05:30Z',
      results: { success: 3, failed: 0, skipped: 0 }
    },
    {
      id: 'op-2',
      type: 'lease-cleanup',
      description: 'Cleanup expired leases older than 30 days',
      targets: ['All subnets'],
      status: 'failed',
      progress: 45,
      started: '2024-01-21T14:30:00Z',
      error: 'Database connection timeout'
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<typeof BULK_OPERATION_TEMPLATES[0] | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)

  // Mock available targets
  const availableTargets = [
    '192.168.1.0/24 (Main Network)',
    '192.168.2.0/24 (Guest Network)', 
    '192.168.10.0/24 (IT Network)',
    '192.168.20.0/24 (VoIP Network)',
    'All Subnets',
    'Production Subnets',
    'Development Subnets'
  ]

  function openForm(template: typeof BULK_OPERATION_TEMPLATES[0]) {
    setSelectedTemplate(template)
    const initialData: Record<string, any> = {}
    template.fields.forEach(field => {
      initialData[field.name] = field.default || ''
    })
    setFormData(initialData)
    setSelectedTargets([])
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function closeForm() {
    setShowForm(false)
    setSelectedTemplate(null)
    setFormData({})
    setSelectedTargets([])
    setError('')
    setSuccess('')
  }

  function updateFormData(field: string, value: any) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function executeBulkOperation() {
    if (!selectedTemplate) return
    
    if (selectedTargets.length === 0) {
      setError('Please select at least one target')
      return
    }

    setProcessing(true)
    setError('')
    setSuccess('')

    try {
      const newOperation: BulkOperation = {
        id: `op-${Date.now()}`,
        type: selectedTemplate.type,
        description: `${selectedTemplate.name} - ${selectedTargets.length} target(s)`,
        targets: selectedTargets,
        status: 'running',
        progress: 0,
        started: new Date().toISOString()
      }

      setOperations(prev => [newOperation, ...prev])
      setSuccess('Bulk operation started successfully')
      closeForm()

      // Simulate operation progress
      const progressSteps = [25, 50, 75, 100]
      for (let i = 0; i < progressSteps.length; i++) {
        setTimeout(() => {
          setOperations(prev => prev.map(op => 
            op.id === newOperation.id 
              ? { 
                  ...op, 
                  progress: progressSteps[i],
                  ...(progressSteps[i] === 100 ? {
                    status: 'completed' as const,
                    completed: new Date().toISOString(),
                    results: {
                      success: selectedTargets.length,
                      failed: 0,
                      skipped: 0
                    }
                  } : {})
                }
              : op
          ))
        }, (i + 1) * 1000)
      }

    } catch (e: any) {
      setError(`Operation failed: ${String(e)}`)
    } finally {
      setProcessing(false)
    }
  }

  function deleteOperation(id: string) {
    if (!confirm('Delete this operation?')) return
    setOperations(prev => prev.filter(op => op.id !== id))
    setSuccess('Operation deleted successfully')
  }

  // function getStatusColor(status: string): string {
  //   switch (status) {
  //     case 'completed': return 'text-green-600'
  //     case 'running': return 'text-blue-600'
  //     case 'failed': return 'text-red-600'
  //     case 'pending': return 'text-yellow-600'
  //     default: return 'text-gray-600'
  //   }
  // }

  function getStatusBadge(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Bulk Operations</h2>
        <p className="text-sm text-gray-600">
          Execute operations across multiple subnets, pools, or reservations
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Operation Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BULK_OPERATION_TEMPLATES.map((template, i) => (
          <Card key={i}>
            <CardHeader>
              <h3 className="font-medium">{template.name}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{template.description}</p>
              <Button 
                onClick={() => openForm(template)} 
                disabled={processing}
                className="w-full"
              >
                Configure & Execute
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Operations History */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Operation History</h3>
        </CardHeader>
        <CardContent>
          {operations.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Operation</Th>
                  <Th>Targets</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th>Results</Th>
                  <Th>Started</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {operations.map((operation) => (
                  <Tr key={operation.id}>
                    <Td>
                      <div className="font-medium">{operation.description}</div>
                      <div className="text-xs text-gray-500">{operation.type}</div>
                    </Td>
                    <Td>
                      <div className="text-sm">
                        {operation.targets.length} target{operation.targets.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {operation.targets.slice(0, 2).join(', ')}
                        {operation.targets.length > 2 && '...'}
                      </div>
                    </Td>
                    <Td>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(operation.status)}`}>
                        {operation.status}
                      </span>
                      {operation.error && (
                        <div className="text-xs text-red-600 mt-1">{operation.error}</div>
                      )}
                    </Td>
                    <Td>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            operation.status === 'completed' ? 'bg-green-500' :
                            operation.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${operation.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1">{operation.progress}%</div>
                    </Td>
                    <Td>
                      {operation.results ? (
                        <div className="text-sm">
                          <div className="text-green-600">✓ {operation.results.success}</div>
                          {operation.results.failed > 0 && (
                            <div className="text-red-600">✗ {operation.results.failed}</div>
                          )}
                          {operation.results.skipped > 0 && (
                            <div className="text-yellow-600">⊘ {operation.results.skipped}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Td>
                    <Td className="text-sm text-gray-600">{formatTimestamp(operation.started)}</Td>
                    <Td>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOperation(operation.id)}
                        disabled={operation.status === 'running'}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">No Bulk Operations</div>
              <div className="text-sm">Execute a bulk operation to see history</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Operation Form Modal */}
      {showForm && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{selectedTemplate.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{selectedTemplate.description}</p>

            <div className="space-y-4">
              {/* Operation Parameters */}
              <div>
                <h4 className="font-medium mb-2">Operation Parameters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate.fields.map((field, i) => (
                    <div key={i}>
                      <label className="block text-sm font-medium mb-1">
                        {field.label}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={formData[field.name] || ''}
                          onChange={e => updateFormData(field.name, e.target.value)}
                          className="w-full px-3 py-2 border rounded"
                          disabled={processing}
                        >
                          <option value="">Select...</option>
                          {field.options?.map((option: string) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData[field.name] || false}
                            onChange={e => updateFormData(field.name, e.target.checked)}
                            disabled={processing}
                          />
                          <span className="text-sm">Enable</span>
                        </label>
                      ) : (
                        <Input
                          type={field.type}
                          value={formData[field.name] || ''}
                          onChange={e => updateFormData(field.name, e.target.value)}
                          disabled={processing}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Selection */}
              <div>
                <h4 className="font-medium mb-2">Select Targets</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                  {availableTargets.map(target => (
                    <label key={target} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(target)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedTargets(prev => [...prev, target])
                          } else {
                            setSelectedTargets(prev => prev.filter(t => t !== target))
                          }
                        }}
                        disabled={processing}
                      />
                      <span className="text-sm">{target}</span>
                    </label>
                  ))}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={processing}>
                Cancel
              </Button>
              <Button 
                onClick={executeBulkOperation} 
                disabled={processing || selectedTargets.length === 0}
              >
                {processing ? 'Executing...' : 'Execute Operation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Bulk Operations Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Safety:</strong> Always create a snapshot before bulk operations</div>
          <div>• <strong>Dry Run:</strong> Use preview mode to test operations before execution</div>
          <div>• <strong>Targets:</strong> Select specific subnets or use predefined groups</div>
          <div>• <strong>Progress:</strong> Monitor operation progress and results in real-time</div>
          <div>• <strong>Rollback:</strong> Use snapshots to rollback if operations cause issues</div>
        </div>
      </div>
    </div>
  )
}
