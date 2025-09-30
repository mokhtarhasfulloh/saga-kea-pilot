import { useState } from 'react'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface OptionData {
  name?: string
  code?: number
  data: string
  space?: string
  'always-send'?: boolean
  'csv-format'?: boolean
}

interface OptionSet {
  id: string
  name: string
  description: string
  options: OptionData[]
  created: string
  updated: string
}

export default function OptionSetsTab() {
  const [optionSets, setOptionSets] = useState<OptionSet[]>([
    {
      id: 'basic-dhcp',
      name: 'Basic DHCP',
      description: 'Standard DHCP options for basic connectivity',
      options: [
        { name: 'routers', data: '192.168.1.1' },
        { name: 'domain-name-servers', data: '8.8.8.8, 8.8.4.4' },
        { name: 'domain-name', data: 'example.com' }
      ],
      created: '2024-01-01',
      updated: '2024-01-01'
    },
    {
      id: 'pxe-boot',
      name: 'PXE Boot',
      description: 'Options for PXE network booting',
      options: [
        { name: 'tftp-server-name', data: '192.168.1.10' },
        { name: 'bootfile-name', data: 'pxelinux.0' },
        { code: 66, data: '192.168.1.10' },
        { code: 67, data: 'pxelinux.0' }
      ],
      created: '2024-01-15',
      updated: '2024-01-15'
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSet, setEditingSet] = useState<OptionSet | null>(null)
  
  // Form state
  const [setName, setSetName] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<OptionData[]>([{ name: '', data: '' }])
  const [saving, setSaving] = useState(false)

  function openForm(optionSet?: OptionSet) {
    setEditingSet(optionSet || null)
    setSetName(optionSet?.name || '')
    setDescription(optionSet?.description || '')
    setOptions(optionSet?.options || [{ name: '', data: '' }])
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingSet(null)
    setSetName('')
    setDescription('')
    setOptions([{ name: '', data: '' }])
    setError('')
    setSuccess('')
  }

  function addOption() {
    setOptions([...options, { name: '', data: '' }])
  }

  function removeOption(index: number) {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  function updateOption(index: number, field: keyof OptionData, value: any) {
    const updated = [...options]
    updated[index] = { ...updated[index], [field]: value }
    setOptions(updated)
  }

  async function saveOptionSet() {
    if (!setName.trim()) {
      setError('Option set name is required')
      return
    }

    if (!description.trim()) {
      setError('Description is required')
      return
    }

    const validOptions = options.filter(opt => opt.name?.trim() || opt.code)
    if (validOptions.length === 0) {
      setError('At least one option is required')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const newSet: OptionSet = {
        id: editingSet?.id || `set-${Date.now()}`,
        name: setName.trim(),
        description: description.trim(),
        options: validOptions,
        created: editingSet?.created || new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0]
      }

      if (editingSet) {
        setOptionSets(prev => prev.map(s => s.id === editingSet.id ? newSet : s))
        setSuccess('Option set updated successfully')
      } else {
        setOptionSets(prev => [...prev, newSet])
        setSuccess('Option set created successfully')
      }

      closeForm()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function deleteOptionSet(id: string) {
    if (!confirm('Delete this option set?')) return
    setOptionSets(prev => prev.filter(s => s.id !== id))
    setSuccess('Option set deleted successfully')
  }

  function duplicateOptionSet(optionSet: OptionSet) {
    const duplicate: OptionSet = {
      ...optionSet,
      id: `set-${Date.now()}`,
      name: `${optionSet.name} (Copy)`,
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0]
    }
    setOptionSets(prev => [...prev, duplicate])
    setSuccess('Option set duplicated successfully')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Option Sets</h2>
          <p className="text-sm text-gray-600">
            Create reusable sets of DHCP options for different use cases
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Create Option Set
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Option Sets Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configured Option Sets</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Options</Th>
                <Th>Updated</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {optionSets.map((set) => (
                <Tr key={set.id}>
                  <Td className="font-medium">{set.name}</Td>
                  <Td className="text-sm text-gray-600">{set.description}</Td>
                  <Td>
                    <div className="text-sm">
                      {set.options.length} option{set.options.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {set.options.slice(0, 2).map(opt => opt.name || `Code ${opt.code}`).join(', ')}
                      {set.options.length > 2 && '...'}
                    </div>
                  </Td>
                  <Td className="text-sm text-gray-600">{set.updated}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openForm(set)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateOptionSet(set)}
                        disabled={saving}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOptionSet(set.id)}
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
        </CardContent>
      </Card>

      {/* Option Set Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingSet ? 'Edit' : 'Create'} Option Set
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <Input
                    value={setName}
                    onChange={e => setSetName(e.target.value)}
                    placeholder="Basic DHCP"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description *
                  </label>
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Standard DHCP options for basic connectivity"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">
                    Options *
                  </label>
                  <Button variant="outline" size="sm" onClick={addOption} disabled={saving}>
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {options.map((option, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Input
                          value={option.name || ''}
                          onChange={e => updateOption(i, 'name', e.target.value)}
                          placeholder="Option name"
                          disabled={saving}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={option.code || ''}
                          onChange={e => updateOption(i, 'code', parseInt(e.target.value) || undefined)}
                          placeholder="Code"
                          disabled={saving}
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          value={option.data}
                          onChange={e => updateOption(i, 'data', e.target.value)}
                          placeholder="Option data"
                          disabled={saving}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={option['always-send'] || false}
                            onChange={e => updateOption(i, 'always-send', e.target.checked)}
                            disabled={saving}
                          />
                          <span className="text-xs">Always send</span>
                        </label>
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeOption(i)}
                          disabled={saving || options.length === 1}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveOptionSet} disabled={saving || !setName.trim()}>
                {saving ? 'Saving...' : 'Save Option Set'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Option Sets Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Option Sets Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Reusability:</strong> Create option sets once and apply to multiple subnets</div>
          <div>• <strong>Templates:</strong> Use predefined templates for common scenarios (PXE, VoIP, etc.)</div>
          <div>• <strong>Option Names:</strong> Use standard DHCP option names or numeric codes</div>
          <div>• <strong>Data Format:</strong> Enter option data in appropriate format (IP, string, hex)</div>
          <div>• <strong>Always Send:</strong> Force option to be sent even if not requested</div>
        </div>
      </div>
    </div>
  )
}
