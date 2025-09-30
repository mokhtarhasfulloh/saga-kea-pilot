import { useState } from 'react'
import HooksConfigTab from './HooksConfigTab'
import HooksStatusTab from './HooksStatusTab'
import HooksLibraryTab from './HooksLibraryTab'

const tabs = ['Hooks Config', 'Hooks Status', 'Library Manager'] as const

type Tab = typeof tabs[number]

export default function HooksManager() {
  const [tab, setTab] = useState<Tab>('Hooks Config')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Hooks & Extensions Manager</h2>
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
      {tab==='Hooks Config' && <HooksConfigTab />}
      {tab==='Hooks Status' && <HooksStatusTab />}
      {tab==='Library Manager' && <HooksLibraryTab />}
    </div>
  )
}
