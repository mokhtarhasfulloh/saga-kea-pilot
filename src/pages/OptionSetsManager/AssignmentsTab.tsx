import { useState } from 'react'
import Button from '../../components/ui/button'
import Select from '../../components/ui/select'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface Assignment {
  id: string
  optionSetId: string
  optionSetName: string
  scope: 'global' | 'subnet' | 'pool' | 'reservation'
  target: string
  targetName: string
  priority: number
  active: boolean
  created: string
}

export default function AssignmentsTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([
    {
      id: 'assign-1',
      optionSetId: 'basic-dhcp',
      optionSetName: 'Basic DHCP',
      scope: 'global',
      target: 'global',
      targetName: 'Global Configuration',
      priority: 1,
      active: true,
      created: '2024-01-01'
    },
    {
      id: 'assign-2',
      optionSetId: 'pxe-boot',
      optionSetName: 'PXE Boot',
      scope: 'subnet',
      target: 'subnet-192.168.10.0',
      targetName: '192.168.10.0/24 (IT Network)',
      priority: 2,
      active: true,
      created: '2024-01-15'
    },
    {
      id: 'assign-3',
      optionSetId: 'voip-sip',
      optionSetName: 'VoIP/SIP Phones',
      scope: 'pool',
      target: 'pool-voip',
      targetName: 'VoIP Pool (192.168.20.100-200)',
      priority: 3,
      active: false,
      created: '2024-01-20'
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  
  // Form state
  const [selectedOptionSet, setSelectedOptionSet] = useState('')
  const [scope, setScope] = useState<Assignment['scope']>('subnet')
  const [target, setTarget] = useState('')
  const [priority, setPriority] = useState(1)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Mock data for dropdowns
  const availableOptionSets = [
    { id: 'basic-dhcp', name: 'Basic DHCP' },
    { id: 'pxe-boot', name: 'PXE Boot' },
    { id: 'voip-sip', name: 'VoIP/SIP Phones' },
    { id: 'tr069-cwmp', name: 'TR-069/CWMP' }
  ]

  const availableTargets = {
    global: [{ id: 'global', name: 'Global Configuration' }],
    subnet: [
      { id: 'subnet-192.168.1.0', name: '192.168.1.0/24 (Main Network)' },
      { id: 'subnet-192.168.10.0', name: '192.168.10.0/24 (IT Network)' },
      { id: 'subnet-192.168.20.0', name: '192.168.20.0/24 (VoIP Network)' }
    ],
    pool: [
      { id: 'pool-main', name: 'Main Pool (192.168.1.100-200)' },
      { id: 'pool-voip', name: 'VoIP Pool (192.168.20.100-200)' },
      { id: 'pool-guest', name: 'Guest Pool (192.168.30.100-150)' }
    ],
    reservation: [
      { id: 'res-server1', name: 'Server1 (192.168.1.10)' },
      { id: 'res-printer', name: 'Printer (192.168.1.20)' }
    ]
  }

  function openForm(assignment?: Assignment) {
    setEditingAssignment(assignment || null)
    setSelectedOptionSet(assignment?.optionSetId || '')
    setScope(assignment?.scope || 'subnet')
    setTarget(assignment?.target || '')
    setPriority(assignment?.priority || 1)
    setActive(assignment?.active ?? true)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingAssignment(null)
    setSelectedOptionSet('')
    setScope('subnet')
    setTarget('')
    setPriority(1)
    setActive(true)
    setError('')
    setSuccess('')
  }

  async function saveAssignment() {
    if (!selectedOptionSet) {
      setError('Please select an option set')
      return
    }

    if (!target) {
      setError('Please select a target')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const optionSet = availableOptionSets.find(s => s.id === selectedOptionSet)
      const targetInfo = availableTargets[scope].find(t => t.id === target)

      const newAssignment: Assignment = {
        id: editingAssignment?.id || `assign-${Date.now()}`,
        optionSetId: selectedOptionSet,
        optionSetName: optionSet?.name || 'Unknown',
        scope,
        target,
        targetName: targetInfo?.name || 'Unknown',
        priority,
        active,
        created: editingAssignment?.created || new Date().toISOString().split('T')[0]
      }

      if (editingAssignment) {
        setAssignments(prev => prev.map(a => a.id === editingAssignment.id ? newAssignment : a))
        setSuccess('Assignment updated successfully')
      } else {
        setAssignments(prev => [...prev, newAssignment])
        setSuccess('Assignment created successfully')
      }

      closeForm()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function deleteAssignment(id: string) {
    if (!confirm('Delete this assignment?')) return
    setAssignments(prev => prev.filter(a => a.id !== id))
    setSuccess('Assignment deleted successfully')
  }

  function toggleAssignment(id: string) {
    setAssignments(prev => prev.map(a => 
      a.id === id ? { ...a, active: !a.active } : a
    ))
    setSuccess('Assignment status updated')
  }

  function getScopeColor(scope: string): string {
    switch (scope) {
      case 'global': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400'
      case 'subnet': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
      case 'pool': return 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400'
      case 'reservation': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Option Set Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign option sets to different scopes (global, subnet, pool, reservation)
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Create Assignment
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Assignment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {assignments.filter(a => a.active).length}
            </div>
            <div className="text-sm text-gray-600">Active Assignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {assignments.filter(a => a.scope === 'subnet').length}
            </div>
            <div className="text-sm text-gray-600">Subnet Assignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {assignments.filter(a => a.scope === 'global').length}
            </div>
            <div className="text-sm text-gray-600">Global Assignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {assignments.filter(a => a.scope === 'pool').length}
            </div>
            <div className="text-sm text-gray-600">Pool Assignments</div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Current Assignments</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Option Set</Th>
                <Th>Scope</Th>
                <Th>Target</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {assignments.map((assignment) => (
                <Tr key={assignment.id}>
                  <Td className="font-medium">{assignment.optionSetName}</Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${getScopeColor(assignment.scope)}`}>
                      {assignment.scope}
                    </span>
                  </Td>
                  <Td className="text-sm text-gray-600">{assignment.targetName}</Td>
                  <Td className="text-center">{assignment.priority}</Td>
                  <Td>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        assignment.active ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className={assignment.active ? 'text-green-600' : 'text-gray-500'}>
                        {assignment.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-sm text-gray-600">{assignment.created}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openForm(assignment)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAssignment(assignment.id)}
                        disabled={saving}
                      >
                        {assignment.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteAssignment(assignment.id)}
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

      {/* Assignment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingAssignment ? 'Edit' : 'Create'} Assignment
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Option Set *
                </label>
                <Select
                  value={selectedOptionSet}
                  onChange={e => setSelectedOptionSet(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select an option set...</option>
                  {availableOptionSets.map(set => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Scope *
                  </label>
                  <Select
                    value={scope}
                    onChange={e => {
                      setScope(e.target.value as Assignment['scope'])
                      setTarget('')
                    }}
                    disabled={saving}
                  >
                    <option value="global">Global</option>
                    <option value="subnet">Subnet</option>
                    <option value="pool">Pool</option>
                    <option value="reservation">Reservation</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Target *
                  </label>
                  <Select
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select a target...</option>
                    {availableTargets[scope].map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={e => setPriority(parseInt(e.target.value) || 1)}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border rounded"
                    disabled={saving}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Lower numbers have higher priority
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                      disabled={saving}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveAssignment} disabled={saving || !selectedOptionSet || !target}>
                {saving ? 'Saving...' : 'Save Assignment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assignments Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Assignment Scope Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Global:</strong> Options apply to all DHCP clients</div>
          <div>• <strong>Subnet:</strong> Options apply to clients in specific subnet</div>
          <div>• <strong>Pool:</strong> Options apply to clients getting addresses from specific pool</div>
          <div>• <strong>Reservation:</strong> Options apply to specific reserved clients</div>
          <div>• <strong>Priority:</strong> Lower numbers override higher numbers (1 = highest priority)</div>
        </div>
      </div>
    </div>
  )
}
