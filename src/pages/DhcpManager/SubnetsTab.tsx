import { useEffect, useState } from 'react'
import { keaConfig } from '../../lib/keaClient'
import { Kea } from '../../lib/keaApi'
import { poolWithinCidr, poolsOverlap } from '../../lib/ip'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'

interface Subnet { id?: number; subnet?: string; pools?: { pool: string }[] }

export default function SubnetsTab() {
  const [subnets, setSubnets] = useState<Subnet[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<null | { mode: 'add' } | { mode: 'edit', subnet: Subnet }>(null)
  const [subnetCIDR, setSubnetCIDR] = useState('')
  const [pools, setPools] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)

  async function refresh() {
    try {
      const r = await keaConfig()
      const cfg = (r.arguments as any)?.Dhcp4 || (r.arguments as any)
      const list: Subnet[] = cfg?.subnet4 || []
      setSubnets(list)
    } catch (e: any) { setError(String(e)) }
  }

  useEffect(() => { refresh() }, [])

  function validate(): string | null {
    if (!subnetCIDR) return 'Enter subnet in CIDR form'
    const list = pools.map(p => p.trim()).filter(Boolean)
    if (list.length === 0) return 'At least one pool required'
    if (poolsOverlap(list)) return 'Pools overlap'
    for (const p of list) if (!poolWithinCidr(p, subnetCIDR)) return `Pool ${p} not within ${subnetCIDR}`
    return null
  }

  async function onSave() {
    const v = validate(); if (v) { setError(v); return }
    setSaving(true); setError('')
    try {
      if (open?.mode === 'add') {
        await Kea.subnetAdd({ subnet4: [{ subnet: subnetCIDR, pools: pools.filter(Boolean).map(pool => ({ pool })) }] })
      } else if (open?.mode === 'edit' && open.subnet.id != null) {
        await Kea.subnetUpdate({ subnet4: [{ id: open.subnet.id, subnet: subnetCIDR, pools: pools.filter(Boolean).map(pool => ({ pool })) }] })
      }
      setOpen(null); setSubnetCIDR(''); setPools(['']);
      await refresh()
    } catch (e: any) { setError(String(e)) } finally { setSaving(false) }
  }

  function openAdd() { setOpen({ mode: 'add' }); setSubnetCIDR(''); setPools(['']) }
  function openEdit(s: Subnet) { setOpen({ mode: 'edit', subnet: s }); setSubnetCIDR(s.subnet || ''); setPools((s.pools||[]).map(p => p.pool)) }

  return (
    <Card>
      <CardHeader className="text-lg font-semibold flex items-center justify-between">
        <span>Subnets</span>
        <Button onClick={openAdd}>Add Subnet</Button>
      </CardHeader>
      <CardContent>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr><Th>ID</Th><Th>Subnet</Th><Th>Pools</Th><Th></Th></Tr>
            </Thead>
            <Tbody>
              {subnets.map((s, i) => (
                <Tr key={s.id ?? i}>
                  <Td>{s.id ?? i}</Td>
                  <Td>{s.subnet}</Td>
                  <Td>{Array.isArray(s.pools) ? s.pools.length : 0}</Td>
                  <Td><Button variant="outline" onClick={() => openEdit(s)}>Edit</Button></Td>
                </Tr>
              ))}
              {subnets.length === 0 && !error && (
                <Tr><Td colSpan={4} className="py-2 text-gray-500">No subnets found</Td></Tr>
              )}
            </Tbody>
          </Table>
        </div>

        {open && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white text-black rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
              <div className="text-lg font-semibold">{open.mode === 'add' ? 'Add Subnet' : 'Edit Subnet'}</div>
              <div className="space-y-2">
                <label className="block text-sm">Subnet (CIDR)</label>
                <Input placeholder="10.0.0.0/24" value={subnetCIDR} onChange={e => setSubnetCIDR(e.target.value)} />
                <label className="block text-sm">Pools (start-end)</label>
                {pools.map((p, idx) => (
                  <div className="flex gap-2" key={idx}>
                    <Input placeholder="10.0.0.10-10.0.0.200" value={p} onChange={e => setPools(arr => arr.map((v,i)=>i===idx? e.target.value : v))} />
                    <Button variant="outline" onClick={() => setPools(arr => arr.filter((_,i)=>i!==idx))}>-</Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setPools(arr => [...arr, ''])}>Add pool</Button>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
                <Button onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

