import { useState } from 'react'
import OptionSetsTab from './OptionSetsTab.tsx'
import TemplatesTab from './TemplatesTab.tsx'
import AssignmentsTab from './AssignmentsTab.tsx'

const tabs = ['Option Sets', 'Templates', 'Assignments'] as const

type Tab = typeof tabs[number]

export default function OptionSetsManager() {
  const [tab, setTab] = useState<Tab>('Option Sets')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Option Sets & Templates</h2>
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
      {tab==='Option Sets' && <OptionSetsTab />}
      {tab==='Templates' && <TemplatesTab />}
      {tab==='Assignments' && <AssignmentsTab />}
    </div>
  )
}
