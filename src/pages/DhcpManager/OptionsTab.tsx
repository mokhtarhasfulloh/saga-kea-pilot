import { useEffect, useMemo, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import Select from '../../components/ui/select'
import { Alert } from '../../components/ui/alert'
import TemplateSelector from '../../components/dhcp/TemplateSelector'
import { validators } from '../../lib/validation'

interface OptionData { name?: string; code?: number; data: string; 'always-send'?: boolean }
interface ClientClass { name: string; test: string }

// TR-069/CWMP Option 43 suboption codes
/*
const TR069_SUBOPTIONS = {
  ACS_URL: 1,
  PROVISIONING_CODE: 2,
  USERNAME: 3,
  PASSWORD: 4,
  PERIODIC_INFORM_INTERVAL: 5,
  CONNECTION_REQUEST_URL: 6,
  CONNECTION_REQUEST_USERNAME: 7,
  CONNECTION_REQUEST_PASSWORD: 8,
} as const
*/

// Vendor-specific option encoders
function encodeTR069Option43(params: {
  acsUrl?: string
  provisioningCode?: string
  username?: string
  password?: string
  periodicInformInterval?: number
}): string {
  const suboptions: string[] = []

  if (params.acsUrl) {
    const len = params.acsUrl.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.acsUrl, 'utf8').toString('hex')
    suboptions.push(`01${len}${hex}`)
  }

  if (params.provisioningCode) {
    const len = params.provisioningCode.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.provisioningCode, 'utf8').toString('hex')
    suboptions.push(`02${len}${hex}`)
  }

  if (params.username) {
    const len = params.username.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.username, 'utf8').toString('hex')
    suboptions.push(`03${len}${hex}`)
  }

  if (params.password) {
    const len = params.password.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.password, 'utf8').toString('hex')
    suboptions.push(`04${len}${hex}`)
  }

  if (params.periodicInformInterval) {
    const value = params.periodicInformInterval.toString(16).padStart(8, '0')
    suboptions.push(`0504${value}`)
  }

  return suboptions.join('')
}

function encodeUnifiOption43(informUrl: string): string {
  // Ubiquiti uses a simple string format for inform URL
  const hex = Buffer.from(informUrl, 'utf8').toString('hex')
  return hex
}

export default function OptionsTab() {
  const [cfg, setCfg] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // New option form
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [data, setData] = useState('')
  const [alwaysSend, setAlwaysSend] = useState(false)
  const [scope, setScope] = useState<'global' | 'subnet' | 'class'>('global')
  const [targetSubnet, setTargetSubnet] = useState('')
  const [targetClass, setTargetClass] = useState('')

  // New client-class form
  const [className, setClassName] = useState('')
  const [classExpr, setClassExpr] = useState('option[60].text == "Vendor"')

  // Preset helpers
  const [acsUrl, setAcsUrl] = useState('')
  const [tftp, setTftp] = useState('')
  const [bootFile, setBootFile] = useState('')

  // TR-069/CWMP advanced form
  const [tr069Mode, setTr069Mode] = useState<'simple' | 'advanced'>('simple')
  const [tr069Params, setTr069Params] = useState({
    acsUrl: '',
    provisioningCode: '',
    username: '',
    password: '',
    periodicInformInterval: 3600,
  })

  // Vendor selection
  const [vendorType, setVendorType] = useState<'tr069' | 'unifi' | 'custom'>('tr069')

  async function load() {
    setErr('')
    try {
      const c = await Kea.configGet()
      setCfg(c?.Dhcp4 || c)
    } catch (e: any) { setErr(String(e)) }
  }

  useEffect(() => { load() }, [])

  const optionData = useMemo<OptionData[]>(() => Array.isArray(cfg?.['option-data']) ? cfg['option-data'] : [], [cfg])
  const classes = useMemo<ClientClass[]>(() => Array.isArray(cfg?.['client-classes']) ? cfg['client-classes'] : [], [cfg])
  const subnets = useMemo(() => Array.isArray(cfg?.subnet4) ? cfg.subnet4 : [], [cfg])

  function validNew(): string | null {
    const optionData = {
      name: name || undefined,
      code: code ? Number(code) : undefined,
      data,
      'always-send': alwaysSend || undefined,
    }

    const validation = validators.optionData(optionData)
    if (!validation.success) {
      return validation.errors.join(', ')
    }

    if (validation.warnings.length > 0) {
      console.warn('Option validation warnings:', validation.warnings)
    }

    return null
  }

  async function addOption() {
    const v = validNew(); if (v) { setErr(v); return }
    if (!cfg) return
    setBusy(true); setErr('')
    try {
      const item: OptionData = { data }
      if (name) (item as any).name = name
      if (code) (item as any).code = Number(code)
      if (alwaysSend) (item as any)['always-send'] = true

      const targetScope = scope === 'subnet' && targetSubnet ?
        { type: 'subnet' as const, id: targetSubnet } :
        scope === 'class' && targetClass ?
        { type: 'class' as const, id: targetClass } :
        undefined

      await addOptionDirect(item, targetScope)
      setName(''); setCode(''); setData(''); setAlwaysSend(false)
    } catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  async function addClientClass() {
    const clientClass = { name: className, test: classExpr }
    const validation = validators.clientClass(clientClass)

    if (!validation.success) {
      setErr(validation.errors.join(', '))
      return
    }

    if (validation.warnings.length > 0) {
      console.warn('Client class validation warnings:', validation.warnings)
    }

    if (!cfg) return
    setBusy(true); setErr('')
    try {
      const next = { ...cfg }
      next['client-classes'] = [...(next['client-classes'] || []), clientClass]
      await Kea.configTestDhcp4(next)
      await Kea.configSetWriteDhcp4(next)
      setClassName(''); setClassExpr('option[60].text == "Vendor"')
      await load()
    } catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  async function addOptionDirect(item: OptionData, targetScope?: { type: 'subnet' | 'class', id: string | number }) {
    if (!cfg) return
    setBusy(true); setErr('')
    try {
      const next = { ...cfg }

      if (targetScope?.type === 'subnet') {
        // Add to specific subnet
        const subnetIndex = next.subnet4?.findIndex((s: any) => s.id === targetScope.id || s.subnet === targetScope.id)
        if (subnetIndex >= 0) {
          next.subnet4[subnetIndex]['option-data'] = [...(next.subnet4[subnetIndex]['option-data'] || []), item]
        }
      } else if (targetScope?.type === 'class') {
        // Add to specific client class
        const classIndex = next['client-classes']?.findIndex((c: any) => c.name === targetScope.id)
        if (classIndex >= 0) {
          next['client-classes'][classIndex]['option-data'] = [...(next['client-classes'][classIndex]['option-data'] || []), item]
        }
      } else {
        // Add to global scope
        next['option-data'] = [...(next['option-data'] || []), item]
      }

      await Kea.configTestDhcp4(next)
      await Kea.configSetWriteDhcp4(next)
      await load()
    } catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  async function addTR069Option() {
    if (!tr069Params.acsUrl) { setErr('ACS URL is required'); return }

    const encodedData = encodeTR069Option43(tr069Params)
    const item: OptionData = {
      code: 43,
      data: encodedData,
      'always-send': true
    }

    const targetScope = scope === 'subnet' && targetSubnet ?
      { type: 'subnet' as const, id: targetSubnet } :
      scope === 'class' && targetClass ?
      { type: 'class' as const, id: targetClass } :
      undefined

    await addOptionDirect(item, targetScope)
  }

  async function addUnifiOption() {
    if (!acsUrl) { setErr('Inform URL is required'); return }

    const encodedData = encodeUnifiOption43(acsUrl)
    const item: OptionData = {
      code: 43,
      data: encodedData,
      'always-send': true
    }

    const targetScope = scope === 'subnet' && targetSubnet ?
      { type: 'subnet' as const, id: targetSubnet } :
      scope === 'class' && targetClass ?
      { type: 'class' as const, id: targetClass } :
      undefined

    await addOptionDirect(item, targetScope)
  }

  return (
    <div className="space-y-3">
      {err && <Alert variant="error">{err}</Alert>}
      <div className="flex gap-2 items-center">
        <Button onClick={load} disabled={busy}>Refresh</Button>
      </div>

      {/* Template Selector */}
      <TemplateSelector
        onApplyTemplate={async (options, targetScope) => {
          for (const option of options) {
            await addOptionDirect(option, targetScope)
          }
        }}
        availableSubnets={subnets}
        availableClasses={classes}
        busy={busy}
      />

      <div className="border rounded p-3 space-y-4">
        <div className="text-sm font-semibold">Vendor-Specific Options & CWMP</div>

        {/* Scope Selector */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-xs mb-1">Target Scope</label>
            <select
              className="w-full px-2 py-1 border rounded text-sm"
              value={scope}
              onChange={e => setScope(e.target.value as any)}
            >
              <option value="global">Global</option>
              <option value="subnet">Subnet</option>
              <option value="class">Client Class</option>
            </select>
          </div>
          {scope === 'subnet' && (
            <div>
              <label className="block text-xs mb-1">Subnet</label>
              <select
                className="w-full px-2 py-1 border rounded text-sm"
                value={targetSubnet}
                onChange={e => setTargetSubnet(e.target.value)}
              >
                <option value="">Select subnet...</option>
                {subnets.map((s: any, i: number) => (
                  <option key={i} value={s.subnet}>{s.subnet} (ID: {s.id || i})</option>
                ))}
              </select>
            </div>
          )}
          {scope === 'class' && (
            <div>
              <label className="block text-xs mb-1">Client Class</label>
              <select
                className="w-full px-2 py-1 border rounded text-sm"
                value={targetClass}
                onChange={e => setTargetClass(e.target.value)}
              >
                <option value="">Select class...</option>
                {classes.map((c, i) => (
                  <option key={i} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Vendor Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs mb-1">Vendor Type</label>
            <Select
              className="text-sm"
              value={vendorType}
              onChange={e => setVendorType(e.target.value as any)}
            >
              <option value="tr069">TR-069/CWMP</option>
              <option value="unifi">Ubiquiti UniFi</option>
              <option value="custom">Custom Option 43</option>
            </Select>
          </div>
        </div>

        {/* TR-069/CWMP Configuration */}
        {vendorType === 'tr069' && (
          <div className="border-l-4 border-blue-500 pl-3 space-y-3">
            <div className="flex gap-2 items-center">
              <label className="text-xs">Mode:</label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={tr069Mode === 'simple'}
                  onChange={() => setTr069Mode('simple')}
                />
                Simple
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  checked={tr069Mode === 'advanced'}
                  onChange={() => setTr069Mode('advanced')}
                />
                Advanced
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1">ACS URL *</label>
                <Input
                  placeholder="https://acs.example.com:7547/acs"
                  value={tr069Params.acsUrl}
                  onChange={e => setTr069Params(p => ({...p, acsUrl: e.target.value}))}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Provisioning Code</label>
                <Input
                  placeholder="PROV123"
                  value={tr069Params.provisioningCode}
                  onChange={e => setTr069Params(p => ({...p, provisioningCode: e.target.value}))}
                />
              </div>
              {tr069Mode === 'advanced' && (
                <>
                  <div>
                    <label className="block text-xs mb-1">Username</label>
                    <Input
                      placeholder="cpe_user"
                      value={tr069Params.username}
                      onChange={e => setTr069Params(p => ({...p, username: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Password</label>
                    <Input
                      type="password"
                      placeholder="cpe_password"
                      value={tr069Params.password}
                      onChange={e => setTr069Params(p => ({...p, password: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Periodic Inform Interval (seconds)</label>
                    <Input
                      type="number"
                      placeholder="3600"
                      value={tr069Params.periodicInformInterval}
                      onChange={e => setTr069Params(p => ({...p, periodicInformInterval: parseInt(e.target.value) || 3600}))}
                    />
                  </div>
                </>
              )}
            </div>
            <Button onClick={addTR069Option} disabled={busy || !tr069Params.acsUrl}>
              Add TR-069 Option 43 (Encoded)
            </Button>
          </div>
        )}

        {/* Ubiquiti UniFi Configuration */}
        {vendorType === 'unifi' && (
          <div className="border-l-4 border-green-500 pl-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-xs mb-1">UniFi Controller Inform URL</label>
                <Input
                  placeholder="http://unifi.example.com:8080/inform"
                  value={acsUrl}
                  onChange={e => setAcsUrl(e.target.value)}
                />
              </div>
              <Button onClick={addUnifiOption} disabled={busy || !acsUrl}>
                Add UniFi Option 43
              </Button>
            </div>
          </div>
        )}

        {/* PXE Boot Configuration */}
        <div className="border-l-4 border-orange-500 pl-3 space-y-3">
          <div className="text-xs font-semibold">PXE Boot Options</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div>
              <label className="block text-xs mb-1">TFTP server (opt66)</label>
              <Input placeholder="10.0.0.5" value={tftp} onChange={e=>setTftp(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Boot file (opt67)</label>
              <Input placeholder="pxelinux.0" value={bootFile} onChange={e=>setBootFile(e.target.value)} />
            </div>
            <div>
              <Button onClick={() => {
                const items: OptionData[] = []
                if (tftp) items.push({ name: 'tftp-server-name', data: tftp })
                if (bootFile) items.push({ name: 'boot-file-name', data: bootFile })
                if (items.length) addOptionDirect(items[0]).then(() => items[1] ? addOptionDirect(items[1]) : undefined)
              }} disabled={busy || (!tftp && !bootFile)}>Add PXE (66/67)</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold mb-1">Global Option Data</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b"><tr>
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4">Code</th>
                <th className="py-1 pr-4">Data</th>
              </tr></thead>
              <tbody>
                {optionData.map((o, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-4">{(o as any).name || ''}</td>
                    <td className="py-1 pr-4">{(o as any).code ?? ''}</td>
                    <td className="py-1 pr-4 break-words max-w-[24rem]">{o.data}</td>
                  </tr>
                ))}
                {optionData.length === 0 && (
                  <tr><td colSpan={3} className="py-2 text-gray-500">No option-data in config</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-1">Client Classes</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b"><tr>
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4">Test</th>
              </tr></thead>
              <tbody>
                {classes.map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-4">{c.name}</td>
                    <td className="py-1 pr-4 break-words max-w-[24rem]">{c.test}</td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr><td colSpan={2} className="py-2 text-gray-500">No client-classes in config</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Add Custom Option</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name (e.g., boot-file-name)" value={name} onChange={e=>setName(e.target.value)} />
            <Input placeholder="Code (e.g., 67)" value={code} onChange={e=>setCode(e.target.value)} />
            <Input placeholder="Data (comma IPs, string, or hex)" value={data} onChange={e=>setData(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alwaysSend} onChange={e=>setAlwaysSend(e.target.checked)} /> always-send</label>
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={addOption} disabled={busy}>Add & Apply</Button>
            <div className="text-xs text-gray-600">
              Will be added to: {scope === 'global' ? 'Global scope' :
                                scope === 'subnet' ? `Subnet: ${targetSubnet || 'none selected'}` :
                                `Class: ${targetClass || 'none selected'}`}
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Tips: Use vendor presets above for TR-069/CWMP and UniFi. Raw hex format: 0x1234abcd
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Add Client Class</div>
          <Input placeholder="Class name" value={className} onChange={e=>setClassName(e.target.value)} />
          <Input placeholder='Test (e.g., option[60].text == "Vendor")' value={classExpr} onChange={e=>setClassExpr(e.target.value)} />
          <div className="flex gap-2"><Button onClick={addClientClass} disabled={busy}>Add Class & Apply</Button></div>
          <div className="text-xs text-muted-foreground">Use client classes to target vendor‑specific Option 43 payloads.</div>
        </div>
      </div>
    </div>
  )
}

