import { useState } from 'react'
import Button from '../ui/button'
import Input from '../ui/input'
import Select from '../ui/select'
import { Alert } from '../ui/alert'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../ui/table'

interface ClientClass {
  name: string
  test: string
  'option-data'?: Array<{
    name?: string
    code?: number
    data: string
  }>
  'only-if-required'?: boolean
  'boot-file-name'?: string
  'server-hostname'?: string
  'next-server'?: string
}

interface Pool {
  pool: string
  'client-class'?: string
  'require-client-classes'?: string[]
}

interface ClientClassManagerProps {
  classes: ClientClass[]
  pools: Pool[]
  onUpdateClasses: (classes: ClientClass[]) => void
  onUpdatePools: (pools: Pool[]) => void
  disabled?: boolean
}

export default function ClientClassManager({ 
  classes, 
  pools, 
  onUpdateClasses, 
  onUpdatePools, 
  disabled 
}: ClientClassManagerProps) {
  const [showClassForm, setShowClassForm] = useState(false)
  const [editingClass, setEditingClass] = useState<ClientClass | null>(null)
  const [error, setError] = useState('')

  // Class form state
  const [className, setClassName] = useState('')
  const [classTest, setClassTest] = useState('')
  const [onlyIfRequired, setOnlyIfRequired] = useState(false)
  const [bootFileName, setBootFileName] = useState('')
  const [serverHostname, setServerHostname] = useState('')
  const [nextServer, setNextServer] = useState('')

  function openClassForm(clientClass?: ClientClass) {
    setEditingClass(clientClass || null)
    setClassName(clientClass?.name || '')
    setClassTest(clientClass?.test || '')
    setOnlyIfRequired(clientClass?.['only-if-required'] || false)
    setBootFileName(clientClass?.['boot-file-name'] || '')
    setServerHostname(clientClass?.['server-hostname'] || '')
    setNextServer(clientClass?.['next-server'] || '')
    setShowClassForm(true)
    setError('')
  }

  function closeClassForm() {
    setShowClassForm(false)
    setEditingClass(null)
    setClassName('')
    setClassTest('')
    setOnlyIfRequired(false)
    setBootFileName('')
    setServerHostname('')
    setNextServer('')
    setError('')
  }

  function saveClass() {
    if (!className.trim()) {
      setError('Class name is required')
      return
    }

    if (!classTest.trim()) {
      setError('Test expression is required')
      return
    }

    // Validate class name format
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(className)) {
      setError('Class name must start with a letter and contain only letters, numbers, hyphens, and underscores')
      return
    }

    // Check for duplicate names
    const existingClass = classes.find(c => c.name === className && c !== editingClass)
    if (existingClass) {
      setError('A class with this name already exists')
      return
    }

    const newClass: ClientClass = {
      name: className.trim(),
      test: classTest.trim(),
      ...(onlyIfRequired && { 'only-if-required': true }),
      ...(bootFileName.trim() && { 'boot-file-name': bootFileName.trim() }),
      ...(serverHostname.trim() && { 'server-hostname': serverHostname.trim() }),
      ...(nextServer.trim() && { 'next-server': nextServer.trim() })
    }

    let updatedClasses = [...classes]
    if (editingClass) {
      const index = classes.findIndex(c => c.name === editingClass.name)
      if (index >= 0) {
        updatedClasses[index] = newClass
      }
    } else {
      updatedClasses.push(newClass)
    }

    onUpdateClasses(updatedClasses)
    closeClassForm()
  }

  function deleteClass(className: string) {
    if (!confirm(`Delete client class "${className}"?`)) return

    // Check if class is used by any pools
    const usedByPools = pools.filter(p => 
      p['client-class'] === className || 
      p['require-client-classes']?.includes(className)
    )

    if (usedByPools.length > 0) {
      setError(`Cannot delete class "${className}" - it is used by ${usedByPools.length} pool(s)`)
      return
    }

    const updatedClasses = classes.filter(c => c.name !== className)
    onUpdateClasses(updatedClasses)
  }

  function updatePoolClass(poolIndex: number, className: string) {
    const updatedPools = [...pools]
    if (className) {
      updatedPools[poolIndex] = { ...updatedPools[poolIndex], 'client-class': className }
    } else {
      const { 'client-class': _, ...poolWithoutClass } = updatedPools[poolIndex]
      updatedPools[poolIndex] = poolWithoutClass
    }
    onUpdatePools(updatedPools)
  }

  function updatePoolRequiredClasses(poolIndex: number, classNames: string) {
    const updatedPools = [...pools]
    const classList = classNames.split(',').map(c => c.trim()).filter(Boolean)
    
    if (classList.length > 0) {
      updatedPools[poolIndex] = { 
        ...updatedPools[poolIndex], 
        'require-client-classes': classList 
      }
    } else {
      const { 'require-client-classes': _, ...poolWithoutRequired } = updatedPools[poolIndex]
      updatedPools[poolIndex] = poolWithoutRequired
    }
    onUpdatePools(updatedPools)
  }

  // Common test expressions
  const testExamples = [
    { name: 'Vendor Class ID', test: 'option[60].text == "MSFT 5.0"' },
    { name: 'MAC Address Prefix', test: 'substring(pkt4.mac, 0, 3) == 0x001122' },
    { name: 'Relay Agent Circuit ID', test: 'relay4[1].hex == 0x736f6d652d737472696e67' },
    { name: 'User Class', test: 'option[77].text == "iPXE"' },
    { name: 'Client ID Prefix', test: 'substring(option[61].hex, 0, 2) == 0x0001' }
  ]

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Client Classes */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Client Classes</h3>
              <p className="text-sm text-muted-foreground">
                Define client classification rules for conditional DHCP behavior
              </p>
            </div>
            <Button onClick={() => openClassForm()} disabled={disabled}>
              Add Class
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Test Expression</Th>
                  <Th>Only If Required</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {classes.map((cls, i) => (
                  <Tr key={i}>
                    <Td className="font-mono">{cls.name}</Td>
                    <Td className="font-mono text-xs max-w-xs truncate" title={cls.test}>
                      {cls.test}
                    </Td>
                    <Td>
                      {cls['only-if-required'] ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openClassForm(cls)}
                          disabled={disabled}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteClass(cls.name)}
                          disabled={disabled}
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
              <div className="text-lg mb-2">No client classes defined</div>
              <div className="text-sm">Create client classes to enable conditional DHCP behavior</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pool Class Assignments */}
      {pools.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Pool Class Assignments</h3>
            <p className="text-sm text-gray-600">
              Assign client classes to pools for conditional address allocation
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Tr>
                  <Th>Pool Range</Th>
                  <Th>Client Class</Th>
                  <Th>Required Classes</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pools.map((pool, i) => (
                  <Tr key={i}>
                    <Td className="font-mono">{pool.pool}</Td>
                    <Td>
                      <Select
                        className="text-sm"
                        value={pool['client-class'] || ''}
                        onChange={e => updatePoolClass(i, e.target.value)}
                        disabled={disabled}
                      >
                        <option value="">No class restriction</option>
                        {classes.map(cls => (
                          <option key={cls.name} value={cls.name}>
                            {cls.name}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Input
                        value={pool['require-client-classes']?.join(', ') || ''}
                        onChange={e => updatePoolRequiredClasses(i, e.target.value)}
                        placeholder="class1, class2"
                        disabled={disabled}
                        className="text-sm"
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Class Form Modal */}
      {showClassForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingClass ? 'Edit' : 'Add'} Client Class
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Name *</label>
                <Input
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  placeholder="KNOWN_CLIENTS"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Test Expression *</label>
                <textarea
                  className="w-full px-3 py-2 border rounded text-sm font-mono"
                  rows={3}
                  value={classTest}
                  onChange={e => setClassTest(e.target.value)}
                  placeholder='option[60].text == "MSFT 5.0"'
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Kea expression to match clients for this class
                </div>
              </div>

              {/* Test Examples */}
              <div>
                <label className="block text-sm font-medium mb-2">Common Examples</label>
                <div className="grid grid-cols-1 gap-2">
                  {testExamples.map((example, i) => (
                    <button
                      key={i}
                      type="button"
                      className="text-left p-2 border rounded hover:bg-gray-50 text-xs"
                      onClick={() => setClassTest(example.test)}
                      disabled={disabled}
                    >
                      <div className="font-medium">{example.name}</div>
                      <div className="font-mono text-gray-600">{example.test}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={onlyIfRequired}
                    onChange={e => setOnlyIfRequired(e.target.checked)}
                    disabled={disabled}
                  />
                  <span className="text-sm">Only if required</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  Only evaluate this class if explicitly required by a subnet or pool
                </div>
              </div>

              {/* PXE Boot Options */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">PXE Boot Options (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Boot File Name</label>
                    <Input
                      value={bootFileName}
                      onChange={e => setBootFileName(e.target.value)}
                      placeholder="pxelinux.0"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Server Hostname</label>
                    <Input
                      value={serverHostname}
                      onChange={e => setServerHostname(e.target.value)}
                      placeholder="tftp.example.com"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Next Server IP</label>
                    <Input
                      value={nextServer}
                      onChange={e => setNextServer(e.target.value)}
                      placeholder="10.0.0.100"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeClassForm} disabled={disabled}>
                Cancel
              </Button>
              <Button onClick={saveClass} disabled={disabled || !className.trim() || !classTest.trim()}>
                Save Class
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
