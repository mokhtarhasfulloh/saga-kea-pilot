import { useState } from 'react'
import ConfigBackendTab from './ConfigBackendTab.tsx'
import ServerTagsTab from './ServerTagsTab.tsx'
import RemoteConfigTab from './RemoteConfigTab.tsx'

const tabs = ['Config Backend', 'Server Tags', 'Remote Config'] as const

type Tab = typeof tabs[number]

export default function ConfigBackendManager() {
  const [tab, setTab] = useState<Tab>('Config Backend')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Config Backend Manager</h2>
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
      {tab==='Config Backend' && <ConfigBackendTab />}
      {tab==='Server Tags' && <ServerTagsTab />}
      {tab==='Remote Config' && <RemoteConfigTab />}
    </div>
  )
}
