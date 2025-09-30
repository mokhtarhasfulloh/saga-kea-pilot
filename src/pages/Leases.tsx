import { useEffect, useState } from 'react'
import { lease4GetAll } from '../lib/keaClient'

type Lease = Record<string, any>

export default function Leases() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    lease4GetAll(50, 0).then(r => {
      const a = (r.arguments as any)
      const list: Lease[] = a?.leases || a?.results || []
      setLeases(list)
    }).catch(e => setError(String(e)))
  }, [])
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Leases (first 50)</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
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

