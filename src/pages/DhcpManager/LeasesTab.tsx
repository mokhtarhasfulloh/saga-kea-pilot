import { useEffect, useState } from 'react'
import { lease4GetAll } from '../../lib/keaClient'
import { subscribeWs } from '../../hooks/useWs'
import Button from '../../components/ui/button'

type Lease = Record<string, any>

export default function LeasesTab() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(25)
  const [offset, setOffset] = useState(() => {
    const s = typeof localStorage !== 'undefined' ? localStorage.getItem('leases:offset') : null
    return s ? Number(s) : 0
  })

  async function load() {
    try {
      const r = await lease4GetAll(limit, offset)
      const a = (r.arguments as any)
      const list: Lease[] = a?.leases || a?.results || []
      setLeases(list)
    } catch (e: any) { setError(String(e)) }
  }

  useEffect(() => { load() }, [limit, offset])

  useEffect(() => { localStorage.setItem('leases:offset', String(offset)) }, [offset])

  useEffect(() => {
    const off = subscribeWs('kea:lease', (msg) => {
      try {
        const t = msg?.type || msg?.topic
        if (t && typeof t === 'string' && t.startsWith('kea:lease:')) {
          if (t === 'kea:lease:added' && msg.payload) {
            setLeases(prev => [msg.payload, ...prev])
          }
          if (t === 'kea:lease:deleted' && msg.payload?.address) {
            setLeases(prev => prev.filter(l => (l.address || l.ipv4_address) !== msg.payload.address))
          }
        }
      } catch {}
    })
    return () => { off && off() }
  }, [])

  return (
    <div className="space-y-2">
      {error && <div className="text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <label className="text-sm">Limit</label>
        <select className="border rounded px-2 py-1 text-sm" value={limit} onChange={e => setLimit(Number(e.target.value))}>
          {[25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <Button variant="outline" onClick={() => setOffset(o => Math.max(0, o - limit))}>Prev</Button>
        <Button variant="outline" onClick={() => setOffset(o => o + limit)}>Next</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left border-b">
            <tr><th className="py-1 pr-4">Address</th><th className="py-1 pr-4">HW</th><th className="py-1 pr-4">Hostname</th><th className="py-1 pr-4">State</th></tr>
          </thead>
          <tbody>
            {leases.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 pr-4">{l.address || l.ipv4_address}</td>
                <td className="py-1 pr-4">{l['hw-address'] || l.hw_address}</td>
                <td className="py-1 pr-4">{l.hostname}</td>
                <td className="py-1 pr-4">{String(l.state ?? '')}</td>
              </tr>
            ))}
            {leases.length === 0 && !error && (
              <tr><td colSpan={4} className="py-2 text-gray-500">No leases returned</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

