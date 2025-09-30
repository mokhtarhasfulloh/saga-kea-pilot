import { useState } from 'react'
import StatisticsOverviewTab from './StatisticsOverviewTab.tsx'
import PerformanceChartsTab from './PerformanceChartsTab.tsx'
import SubnetStatsTab from './SubnetStatsTab.tsx'

const tabs = ['Overview', 'Performance Charts', 'Subnet Statistics'] as const

type Tab = typeof tabs[number]

export default function StatisticsManager() {
  const [tab, setTab] = useState<Tab>('Overview')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Statistics & Monitoring</h2>
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
      {tab==='Overview' && <StatisticsOverviewTab />}
      {tab==='Performance Charts' && <PerformanceChartsTab />}
      {tab==='Subnet Statistics' && <SubnetStatsTab />}
    </div>
  )
}
