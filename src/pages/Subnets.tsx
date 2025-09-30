import { useEffect, useState } from 'react'
import { keaConfig } from '../lib/keaClient'

type Subnet = { id?: number; subnet?: string }

export default function Subnets() {
  const [subnets, setSubnets] = useState<Subnet[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    keaConfig().then(r => {
      const cfg = (r.arguments as any)?.Dhcp4 || (r.arguments as any)
      const list: Subnet[] = cfg?.subnet4 || []
      setSubnets(list)
    }).catch(e => setError(String(e)))
  }, [])
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Subnets</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <ul className="list-disc pl-5 space-y-1">
        {subnets.map((s, i) => (
          <li key={`${s.id ?? i}`}>{s.id ?? i}: {s.subnet}</li>
        ))}
        {subnets.length === 0 && !error && <li className="text-gray-500">No subnets found</li>}
      </ul>
    </div>
  )
}

