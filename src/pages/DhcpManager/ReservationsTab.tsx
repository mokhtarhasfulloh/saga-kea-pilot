import { useEffect, useState } from 'react'
import { keaConfig } from '../../lib/keaClient'
import { Kea } from '../../lib/keaApi'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'

interface Reservation { subnet_id?: number; 'ip-address'?: string; 'hw-address'?: string; hostname?: string }

export default function ReservationsTab() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [error, setError] = useState('')
  const [subnetId, setSubnetId] = useState('')
  const [ip, setIp] = useState('')
  const [hw, setHw] = useState('')
  const [hostname, setHostname] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setError('')
    try {
      const r = await keaConfig()
      const cfg = (r.arguments as any)?.Dhcp4 || (r.arguments as any)
      const list: Reservation[] = []
      for (const s of (cfg?.subnet4 || [])) {
        if (Array.isArray(s.reservations)) {
          for (const res of s.reservations) list.push({ ...res, subnet_id: s.id })
        }
      }
      setReservations(list)
    } catch (e: any) { setError(String(e)) }
  }

  useEffect(() => { refresh() }, [])

  async function onAdd() {
    setError('')
    if (!subnetId || !ip || !hw) { setError('Please provide subnet-id, ip-address, and hw-address'); return }
    setSaving(true)
    try {
      await Kea.reservationAdd({ 'subnet-id': Number(subnetId), reservation: { 'ip-address': ip, 'hw-address': hw, hostname } })
      setSubnetId(''); setIp(''); setHw(''); setHostname('')
      await refresh()
    } catch (e: any) { setError(String(e)) } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="text-lg font-semibold">Reservations</CardHeader>
      <CardContent>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Subnet ID" value={subnetId} onChange={e => setSubnetId(e.target.value)} />
            <Input placeholder="IP address" value={ip} onChange={e => setIp(e.target.value)} />
            <Input placeholder="HW address (aa:bb:cc:dd:ee:ff)" value={hw} onChange={e => setHw(e.target.value)} />
            <Input placeholder="Hostname (optional)" value={hostname} onChange={e => setHostname(e.target.value)} />
          </div>
          <Button onClick={onAdd} disabled={saving}>{saving ? 'Saving...' : 'Add Reservation'}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left border-b">
              <tr><th className="py-1 pr-4">Subnet</th><th className="py-1 pr-4">IP</th><th className="py-1 pr-4">HW</th><th className="py-1 pr-4">Hostname</th></tr>
            </thead>
            <tbody>
              {reservations.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 pr-4">{r.subnet_id}</td>
                  <td className="py-1 pr-4">{r['ip-address']}</td>
                  <td className="py-1 pr-4">{r['hw-address']}</td>
                  <td className="py-1 pr-4">{r.hostname}</td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-gray-500">No reservations found in config</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

