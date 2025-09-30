import { useState } from 'react'
import HaConfigTab from './HaConfigTab.tsx'
import HaStatusTab from './HaStatusTab.tsx'
import HaSyncTab from './HaSyncTab.tsx'

const tabs = ['HA Config', 'HA Status', 'HA Sync'] as const

type Tab = typeof tabs[number]

export default function HaManager() {
  const [tab, setTab] = useState<Tab>('HA Config')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">High Availability Manager</h2>
      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded border transition-colors ${tab===t? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab==='HA Config' && <HaConfigTab />}
      {tab==='HA Status' && <HaStatusTab />}
      {tab==='HA Sync' && <HaSyncTab />}
    </div>
  )
}
