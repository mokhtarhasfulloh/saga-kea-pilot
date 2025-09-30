import { useState } from 'react'
import DdnsConfigTab from './DdnsConfigTab.tsx'
import DdnsStatusTab from './DdnsStatusTab.tsx'
import FqdnPreviewTab from './FqdnPreviewTab'

const tabs = ['DDNS Config', 'DDNS Status', 'FQDN Preview'] as const

type Tab = typeof tabs[number]

export default function DdnsManager() {
  const [tab, setTab] = useState<Tab>('DDNS Config')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">DHCP-DDNS Manager</h2>
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
      {tab==='DDNS Config' && <DdnsConfigTab />}
      {tab==='DDNS Status' && <DdnsStatusTab />}
      {tab==='FQDN Preview' && <FqdnPreviewTab />}
    </div>
  )
}
