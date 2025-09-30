import { useState } from 'react'
import SnapshotsTab from './SnapshotsTab.tsx'
import ImportExportTab from './ImportExportTab.tsx'
import BulkOperationsTab from './BulkOperationsTab.tsx'

const tabs = ['Snapshots', 'Import/Export', 'Bulk Operations'] as const

type Tab = typeof tabs[number]

export default function BulkOpsManager() {
  const [tab, setTab] = useState<Tab>('Snapshots')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Bulk Operations & Snapshots</h2>
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
      {tab==='Snapshots' && <SnapshotsTab />}
      {tab==='Import/Export' && <ImportExportTab />}
      {tab==='Bulk Operations' && <BulkOperationsTab />}
    </div>
  )
}
