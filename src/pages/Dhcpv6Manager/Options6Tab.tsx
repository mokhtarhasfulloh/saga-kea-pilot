import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import Select from '../../components/ui/select'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface Option6Data {
  name?: string
  code?: number
  data: string
  space?: string
  'always-send'?: boolean
  'never-send'?: boolean
  'csv-format'?: boolean
}

interface Option6Def {
  name: string
  code: number
  type: string
  space?: string
  'record-types'?: string
  encapsulate?: string
  array?: boolean
}

// Standard DHCPv6 options
const STANDARD_OPTIONS6 = {
  1: { name: 'clientid', type: 'binary' },
  2: { name: 'serverid', type: 'binary' },
  3: { name: 'ia-na', type: 'record' },
  4: { name: 'ia-ta', type: 'record' },
  5: { name: 'iaaddr', type: 'record' },
  6: { name: 'oro', type: 'uint16', array: true },
  7: { name: 'preference', type: 'uint8' },
  8: { name: 'elapsed-time', type: 'uint16' },
  11: { name: 'auth', type: 'record' },
  12: { name: 'unicast', type: 'ipv6-address' },
  13: { name: 'status-code', type: 'record' },
  14: { name: 'rapid-commit', type: 'empty' },
  15: { name: 'user-class', type: 'record', array: true },
  16: { name: 'vendor-class', type: 'record' },
  17: { name: 'vendor-opts', type: 'record' },
  18: { name: 'interface-id', type: 'binary' },
  19: { name: 'reconf-msg', type: 'uint8' },
  20: { name: 'reconf-accept', type: 'empty' },
  21: { name: 'sip-server-dns', type: 'fqdn', array: true },
  22: { name: 'sip-server-addr', type: 'ipv6-address', array: true },
  23: { name: 'dns-servers', type: 'ipv6-address', array: true },
  24: { name: 'domain-search', type: 'fqdn', array: true },
  25: { name: 'ia-pd', type: 'record' },
  26: { name: 'iaprefix', type: 'record' },
  27: { name: 'nis-servers', type: 'ipv6-address', array: true },
  28: { name: 'nisp-servers', type: 'ipv6-address', array: true },
  29: { name: 'nis-domain-name', type: 'fqdn' },
  30: { name: 'nisp-domain-name', type: 'fqdn' },
  31: { name: 'sntp-servers', type: 'ipv6-address', array: true },
  32: { name: 'information-refresh-time', type: 'uint32' },
  33: { name: 'bcmcs-server-dns', type: 'fqdn', array: true },
  34: { name: 'bcmcs-server-addr', type: 'ipv6-address', array: true },
  36: { name: 'geoconf-civic', type: 'record' },
  37: { name: 'remote-id', type: 'binary' },
  38: { name: 'subscriber-id', type: 'binary' },
  39: { name: 'client-fqdn', type: 'record' }
} as const

export default function Options6Tab() {
  const [globalOptions, setGlobalOptions] = useState<Option6Data[]>([])
  const [customDefinitions, setCustomDefinitions] = useState<Option6Def[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [showDefForm, setShowDefForm] = useState(false)
  const [editingOption, setEditingOption] = useState<Option6Data | null>(null)
  const [editingDef, setEditingDef] = useState<Option6Def | null>(null)
  
  // Option form state
  const [optionName, setOptionName] = useState('')
  const [optionCode, setOptionCode] = useState<number | ''>('')
  const [optionData, setOptionData] = useState('')
  const [optionSpace, setOptionSpace] = useState('dhcp6')
  const [alwaysSend, setAlwaysSend] = useState(false)
  const [csvFormat, setCsvFormat] = useState(false)
  
  // Definition form state
  const [defName, setDefName] = useState('')
  const [defCode, setDefCode] = useState<number | ''>('')
  const [defType, setDefType] = useState('string')
  const [defSpace, setDefSpace] = useState('dhcp6')
  const [defArray, setDefArray] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}
      
      setGlobalOptions(dhcp6['option-data'] || [])
      setCustomDefinitions(dhcp6['option-def'] || [])
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openOptionForm(option?: Option6Data) {
    setEditingOption(option || null)
    setOptionName(option?.name || '')
    setOptionCode(option?.code || '')
    setOptionData(option?.data || '')
    setOptionSpace(option?.space || 'dhcp6')
    setAlwaysSend(option?.['always-send'] || false)
    setCsvFormat(option?.['csv-format'] || false)
    setShowOptionForm(true)
    setError('')
  }

  function openDefForm(def?: Option6Def) {
    setEditingDef(def || null)
    setDefName(def?.name || '')
    setDefCode(def?.code || '')
    setDefType(def?.type || 'string')
    setDefSpace(def?.space || 'dhcp6')
    setDefArray(def?.array || false)
    setShowDefForm(true)
    setError('')
  }

  function closeOptionForm() {
    setShowOptionForm(false)
    setEditingOption(null)
    setOptionName('')
    setOptionCode('')
    setOptionData('')
    setOptionSpace('dhcp6')
    setAlwaysSend(false)
    setCsvFormat(false)
    setError('')
  }

  function closeDefForm() {
    setShowDefForm(false)
    setEditingDef(null)
    setDefName('')
    setDefCode('')
    setDefType('string')
    setDefSpace('dhcp6')
    setDefArray(false)
    setError('')
  }

  function validateOptionForm(): string | null {
    if (!optionName.trim() && !optionCode) {
      return 'Either option name or code must be specified'
    }
    if (!optionData.trim()) {
      return 'Option data is required'
    }
    if (optionCode && (optionCode < 1 || optionCode > 65535)) {
      return 'Option code must be between 1-65535'
    }
    return null
  }

  function validateDefForm(): string | null {
    if (!defName.trim()) return 'Option name is required'
    if (!defCode || defCode < 1 || defCode > 65535) {
      return 'Option code must be between 1-65535'
    }
    if (!defType.trim()) return 'Option type is required'
    
    // Check for conflicts with standard options
    if (STANDARD_OPTIONS6[defCode as keyof typeof STANDARD_OPTIONS6]) {
      return `Option code ${defCode} is reserved for standard option`
    }
    
    return null
  }

  async function saveOption() {
    const validationError = validateOptionForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const optionDataObj: Option6Data = {
        ...(optionName.trim() && { name: optionName.trim() }),
        ...(optionCode && { code: optionCode }),
        data: optionData.trim(),
        space: optionSpace,
        ...(alwaysSend && { 'always-send': true }),
        ...(csvFormat && { 'csv-format': true })
      }

      let updatedOptions = [...(dhcp6['option-data'] || [])]
      
      if (editingOption) {
        const index = updatedOptions.findIndex(opt => 
          (opt.name === editingOption.name && opt.name) ||
          (opt.code === editingOption.code && opt.code)
        )
        if (index >= 0) {
          updatedOptions[index] = optionDataObj
        }
      } else {
        updatedOptions.push(optionDataObj)
      }

      const updatedConfig = {
        ...dhcp6,
        'option-data': updatedOptions
      }

      await Kea.action('config-test', { Dhcp6: updatedConfig })
      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      closeOptionForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function saveDefinition() {
    const validationError = validateDefForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const defData: Option6Def = {
        name: defName.trim(),
        code: defCode as number,
        type: defType,
        space: defSpace,
        ...(defArray && { array: true })
      }

      let updatedDefs = [...(dhcp6['option-def'] || [])]
      
      if (editingDef) {
        const index = updatedDefs.findIndex(def => def.code === editingDef.code)
        if (index >= 0) {
          updatedDefs[index] = defData
        }
      } else {
        updatedDefs.push(defData)
      }

      const updatedConfig = {
        ...dhcp6,
        'option-def': updatedDefs
      }

      await Kea.action('config-test', { Dhcp6: updatedConfig })
      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      closeDefForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function deleteOption(option: Option6Data) {
    if (!confirm('Delete this DHCPv6 option?')) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const updatedOptions = (dhcp6['option-data'] || []).filter((opt: Option6Data) =>
        !((opt.name === option.name && opt.name) ||
          (opt.code === option.code && opt.code))
      )

      const updatedConfig = {
        ...dhcp6,
        'option-data': updatedOptions
      }

      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function deleteDefinition(def: Option6Def) {
    if (!confirm('Delete this option definition?')) return

    setSaving(true)
    setError('')

    try {
      const config = await Kea.configGet()
      const dhcp6 = config?.Dhcp6 || {}

      const updatedDefs = (dhcp6['option-def'] || []).filter((d: Option6Def) => d.code !== def.code)

      const updatedConfig = {
        ...dhcp6,
        'option-def': updatedDefs
      }

      await Kea.action('config-set', { Dhcp6: updatedConfig })
      await Kea.action('config-write')

      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function getOptionDescription(option: Option6Data): string {
    const code = option.code
    if (code && STANDARD_OPTIONS6[code as keyof typeof STANDARD_OPTIONS6]) {
      const std = STANDARD_OPTIONS6[code as keyof typeof STANDARD_OPTIONS6]
      return `${std.name} (${std.type}${'array' in std && std.array ? '[]' : ''})`
    }
    return option.name || `Code ${option.code}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading DHCPv6 options...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">DHCPv6 Options</h2>
        <p className="text-sm text-gray-600">
          Configure global DHCPv6 options and custom option definitions
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Global Options */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Global DHCPv6 Options</h3>
            <Button onClick={() => openOptionForm()} disabled={saving}>
              Add Option
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {globalOptions.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Option</Th>
                  <Th>Code</Th>
                  <Th>Data</Th>
                  <Th>Space</Th>
                  <Th>Flags</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {globalOptions.map((option, i) => (
                  <Tr key={i}>
                    <Td>{getOptionDescription(option)}</Td>
                    <Td>{option.code || 'N/A'}</Td>
                    <Td className="font-mono text-xs max-w-xs truncate">
                      {option.data}
                    </Td>
                    <Td>{option.space || 'dhcp6'}</Td>
                    <Td className="text-xs">
                      {option['always-send'] && <span className="text-green-600">Always</span>}
                      {option['csv-format'] && <span className="text-blue-600">CSV</span>}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOptionForm(option)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteOption(option)}
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">No global DHCPv6 options configured</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Option Definitions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Custom Option Definitions</h3>
            <Button onClick={() => openDefForm()} disabled={saving}>
              Add Definition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customDefinitions.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Code</Th>
                  <Th>Type</Th>
                  <Th>Space</Th>
                  <Th>Array</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {customDefinitions.map((def, i) => (
                  <Tr key={i}>
                    <Td className="font-medium">{def.name}</Td>
                    <Td>{def.code}</Td>
                    <Td>{def.type}</Td>
                    <Td>{def.space || 'dhcp6'}</Td>
                    <Td>
                      {def.array ? (
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
                          onClick={() => openDefForm(def)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteDefinition(def)}
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">No custom option definitions</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Common DHCPv6 Options Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Common DHCPv6 Options</h3>
        <div className="text-sm text-blue-700 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>• <strong>23:</strong> DNS Servers (dns-servers)</div>
          <div>• <strong>24:</strong> Domain Search (domain-search)</div>
          <div>• <strong>31:</strong> SNTP Servers (sntp-servers)</div>
          <div>• <strong>32:</strong> Info Refresh Time</div>
          <div>• <strong>39:</strong> Client FQDN (client-fqdn)</div>
          <div>• <strong>21:</strong> SIP Server DNS Names</div>
        </div>
      </div>

      {/* Option Form Modal */}
      {showOptionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingOption ? 'Edit' : 'Add'} DHCPv6 Option
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Option Name</label>
                  <Input
                    value={optionName}
                    onChange={e => setOptionName(e.target.value)}
                    placeholder="dns-servers"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Option Code</label>
                  <Input
                    type="number"
                    value={optionCode}
                    onChange={e => setOptionCode(parseInt(e.target.value) || '')}
                    placeholder="23"
                    min={1}
                    max={65535}
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Option Data *</label>
                <Input
                  value={optionData}
                  onChange={e => setOptionData(e.target.value)}
                  placeholder="2001:4860:4860::8888, 2001:4860:4860::8844"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Option value (format depends on option type)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Option Space</label>
                  <Select
                    value={optionSpace}
                    onChange={e => setOptionSpace(e.target.value)}
                    disabled={saving}
                  >
                    <option value="dhcp6">dhcp6</option>
                    <option value="vendor-4491">vendor-4491 (CableLabs)</option>
                    <option value="vendor-25506">vendor-25506 (Ubiquiti)</option>
                    <option value="vendor-311">vendor-311 (Microsoft)</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={alwaysSend}
                    onChange={e => setAlwaysSend(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm">Always Send</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={csvFormat}
                    onChange={e => setCsvFormat(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm">CSV Format</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeOptionForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveOption} disabled={saving}>
                {saving ? 'Saving...' : 'Save Option'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Definition Form Modal */}
      {showDefForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingDef ? 'Edit' : 'Add'} Option Definition
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Option Name *</label>
                  <Input
                    value={defName}
                    onChange={e => setDefName(e.target.value)}
                    placeholder="custom-option"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Option Code *</label>
                  <Input
                    type="number"
                    value={defCode}
                    onChange={e => setDefCode(parseInt(e.target.value) || '')}
                    placeholder="1000"
                    min={1}
                    max={65535}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Data Type *</label>
                  <Select
                    value={defType}
                    onChange={e => setDefType(e.target.value)}
                    disabled={saving}
                  >
                    <option value="empty">empty</option>
                    <option value="uint8">uint8</option>
                    <option value="uint16">uint16</option>
                    <option value="uint32">uint32</option>
                    <option value="string">string</option>
                    <option value="fqdn">fqdn</option>
                    <option value="ipv6-address">ipv6-address</option>
                    <option value="ipv6-prefix">ipv6-prefix</option>
                    <option value="binary">binary</option>
                    <option value="record">record</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Option Space</label>
                  <Select
                    value={defSpace}
                    onChange={e => setDefSpace(e.target.value)}
                    disabled={saving}
                  >
                    <option value="dhcp6">dhcp6</option>
                    <option value="vendor-4491">vendor-4491</option>
                    <option value="vendor-25506">vendor-25506</option>
                    <option value="vendor-311">vendor-311</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={defArray}
                    onChange={e => setDefArray(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm">Array Type</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  Enable if this option can contain multiple values
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeDefForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveDefinition} disabled={saving}>
                {saving ? 'Saving...' : 'Save Definition'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
