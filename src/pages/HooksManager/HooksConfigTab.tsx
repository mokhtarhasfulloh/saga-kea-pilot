import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface HookLibrary {
  library: string
  parameters?: Record<string, any>
}

interface KnownHook {
  name: string
  library: string
  description: string
  parameters?: Array<{
    name: string
    type: string
    description: string
    required: boolean
    default?: any
  }>
}

const KNOWN_HOOKS: KnownHook[] = [
  {
    name: 'Subnet Commands',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_subnet_cmds.so',
    description: 'Runtime subnet and pool management commands'
  },
  {
    name: 'Host Commands',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_host_cmds.so',
    description: 'Host reservation management commands'
  },
  {
    name: 'Lease Commands',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_lease_cmds.so',
    description: 'Lease query and management commands'
  },
  {
    name: 'Statistics Commands',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_stat_cmds.so',
    description: 'Statistics collection and reporting'
  },
  {
    name: 'High Availability',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_ha.so',
    description: 'High availability and failover support',
    parameters: [
      { name: 'this-server-name', type: 'string', description: 'Name of this server', required: true },
      { name: 'mode', type: 'string', description: 'HA mode (hot-standby or load-balancing)', required: true },
      { name: 'heartbeat-delay', type: 'number', description: 'Heartbeat interval in milliseconds', required: false, default: 10000 },
      { name: 'max-response-delay', type: 'number', description: 'Maximum response delay in milliseconds', required: false, default: 60000 }
    ]
  },
  {
    name: 'Forensic Logging',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_legal_log.so',
    description: 'Detailed forensic logging for compliance'
  },
  {
    name: 'Flex ID',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_flex_id.so',
    description: 'Flexible client identification'
  },
  {
    name: 'RADIUS',
    library: '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_radius.so',
    description: 'RADIUS authentication and accounting'
  }
]

export default function HooksConfigTab() {
  const [hookLibraries, setHookLibraries] = useState<HookLibrary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingHook, setEditingHook] = useState<HookLibrary | null>(null)
  
  // Form state
  const [selectedKnownHook, setSelectedKnownHook] = useState('')
  const [customLibraryPath, setCustomLibraryPath] = useState('')
  const [parameters, setParameters] = useState<Record<string, any>>({})

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}
      setHookLibraries(dhcp4['hooks-libraries'] || [])
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openForm(hook?: HookLibrary) {
    setEditingHook(hook || null)
    
    if (hook) {
      const knownHook = KNOWN_HOOKS.find(kh => kh.library === hook.library)
      setSelectedKnownHook(knownHook ? knownHook.name : '')
      setCustomLibraryPath(knownHook ? '' : hook.library)
      setParameters(hook.parameters || {})
    } else {
      setSelectedKnownHook('')
      setCustomLibraryPath('')
      setParameters({})
    }
    
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingHook(null)
    setSelectedKnownHook('')
    setCustomLibraryPath('')
    setParameters({})
    setError('')
  }

  function handleKnownHookChange(hookName: string) {
    setSelectedKnownHook(hookName)
    setCustomLibraryPath('')
    
    const knownHook = KNOWN_HOOKS.find(kh => kh.name === hookName)
    if (knownHook?.parameters) {
      const defaultParams: Record<string, any> = {}
      knownHook.parameters.forEach(param => {
        if (param.default !== undefined) {
          defaultParams[param.name] = param.default
        }
      })
      setParameters(defaultParams)
    } else {
      setParameters({})
    }
  }

  function updateParameter(name: string, value: any) {
    setParameters(prev => ({ ...prev, [name]: value }))
  }

  function removeParameter(name: string) {
    setParameters(prev => {
      const newParams = { ...prev }
      delete newParams[name]
      return newParams
    })
  }

  function addCustomParameter() {
    const name = prompt('Parameter name:')
    if (name && !parameters[name]) {
      setParameters(prev => ({ ...prev, [name]: '' }))
    }
  }

  async function saveHook() {
    const libraryPath = selectedKnownHook 
      ? KNOWN_HOOKS.find(kh => kh.name === selectedKnownHook)?.library || ''
      : customLibraryPath

    if (!libraryPath.trim()) {
      setError('Library path is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      const newHook: HookLibrary = {
        library: libraryPath.trim(),
        ...(Object.keys(parameters).length > 0 && { parameters })
      }

      let updatedHooks = [...(dhcp4['hooks-libraries'] || [])]
      
      if (editingHook) {
        const index = updatedHooks.findIndex(h => h.library === editingHook.library)
        if (index >= 0) {
          updatedHooks[index] = newHook
        }
      } else {
        // Check if hook already exists
        const existingIndex = updatedHooks.findIndex(h => h.library === libraryPath)
        if (existingIndex >= 0) {
          setError('Hook library already loaded')
          setSaving(false)
          return
        }
        updatedHooks.push(newHook)
      }

      const updatedConfig = {
        ...dhcp4,
        'hooks-libraries': updatedHooks
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      closeForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function removeHook(library: string) {
    if (!confirm(`Remove hook library: ${library}?`)) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      const updatedHooks = (dhcp4['hooks-libraries'] || []).filter((h: { library: string }) => h.library !== library)

      const updatedConfig = {
        ...dhcp4,
        'hooks-libraries': updatedHooks
      }

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function getHookName(library: string): string {
    const knownHook = KNOWN_HOOKS.find(kh => kh.library === library)
    return knownHook?.name || library.split('/').pop()?.replace(/^lib|\.so$/g, '') || library
  }

  function getHookDescription(library: string): string {
    const knownHook = KNOWN_HOOKS.find(kh => kh.library === library)
    return knownHook?.description || 'Custom hook library'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading hooks configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Hooks Configuration</h2>
          <p className="text-sm text-gray-600">
            Manage Kea hook libraries and their parameters
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Add Hook Library
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Loaded Hooks */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Loaded Hook Libraries</h3>
        </CardHeader>
        <CardContent>
          {hookLibraries.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Library Path</Th>
                  <Th>Parameters</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {hookLibraries.map((hook, i) => (
                  <Tr key={i}>
                    <Td>
                      <div className="font-medium">{getHookName(hook.library)}</div>
                      <div className="text-sm text-gray-600">{getHookDescription(hook.library)}</div>
                    </Td>
                    <Td className="font-mono text-sm">{hook.library}</Td>
                    <Td>
                      {hook.parameters ? (
                        <div className="text-sm">
                          {Object.keys(hook.parameters).length} parameter{Object.keys(hook.parameters).length !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openForm(hook)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeHook(hook.library)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">No hook libraries loaded</div>
              <div className="text-sm">Add hook libraries to extend Kea functionality</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hook Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingHook ? 'Edit' : 'Add'} Hook Library
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Hook Library Type
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedKnownHook}
                    onChange={e => handleKnownHookChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    disabled={saving}
                  >
                    <option value="">Select a known hook or use custom path</option>
                    {KNOWN_HOOKS.map(hook => (
                      <option key={hook.name} value={hook.name}>
                        {hook.name} - {hook.description}
                      </option>
                    ))}
                  </select>
                  
                  {!selectedKnownHook && (
                    <Input
                      value={customLibraryPath}
                      onChange={e => setCustomLibraryPath(e.target.value)}
                      placeholder="/path/to/custom/hook.so"
                      disabled={saving}
                    />
                  )}
                </div>
              </div>

              {/* Parameters */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">
                    Parameters
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCustomParameter}
                    disabled={saving}
                  >
                    Add Parameter
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(parameters).map(([name, value]) => (
                    <div key={name} className="flex gap-2 items-center">
                      <Input
                        value={name}
                        disabled
                        className="w-1/3"
                      />
                      <Input
                        value={value}
                        onChange={e => updateParameter(name, e.target.value)}
                        placeholder="Parameter value"
                        disabled={saving}
                        className="flex-1"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeParameter(name)}
                        disabled={saving}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  {Object.keys(parameters).length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No parameters configured
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveHook} disabled={saving}>
                {saving ? 'Saving...' : 'Save Hook'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Available Hooks Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Available Hook Libraries</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Subnet Commands:</strong> Runtime subnet/pool management (subnet4-add, subnet4-del)</div>
          <div>• <strong>Host Commands:</strong> Host reservation management (reservation-add, reservation-del)</div>
          <div>• <strong>Lease Commands:</strong> Lease queries and operations (lease4-get, lease4-get-page)</div>
          <div>• <strong>Statistics Commands:</strong> Enhanced statistics collection and reporting</div>
          <div>• <strong>High Availability:</strong> Failover and load balancing between servers</div>
          <div>• <strong>Forensic Logging:</strong> Detailed audit logs for compliance requirements</div>
        </div>
      </div>
    </div>
  )
}
