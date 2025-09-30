import { useState } from 'react'
import ZoneOverviewTab from './ZoneOverviewTab.tsx'
import ZonesTab from './ZonesTab.tsx'
import RecordsTab from './RecordsTab.tsx'
import BulkOperationsTab from './BulkOperationsTab.tsx'
import DnsQueryTestTab from './DnsQueryTestTab.tsx'
import ZoneTransferTab from './ZoneTransferTab.tsx'
import DnssecTab from './DnssecTab.tsx'
import DnsMonitoringTab from './DnsMonitoringTab.tsx'
import DdnsTab from './DdnsTab.tsx'

const tabs = ['Overview', 'Zones', 'Records', 'Bulk Operations', 'Query Test', 'Zone Transfer', 'DNSSEC', 'DDNS', 'Monitoring'] as const

type Tab = typeof tabs[number]

export default function DnsManager() {
  const [tab, setTab] = useState<Tab>('Overview')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">DNS Manager</h2>
      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded border transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' && <ZoneOverviewTab />}
      {tab === 'Zones' && <ZonesTab />}
      {tab === 'Records' && <RecordsTab />}
      {tab === 'Bulk Operations' && <BulkOperationsTab />}
      {tab === 'Query Test' && <DnsQueryTestTab />}
      {tab === 'Zone Transfer' && <ZoneTransferTab />}
      {tab === 'DNSSEC' && <DnssecTab />}
      {tab === 'DDNS' && <DdnsTab />}
      {tab === 'Monitoring' && <DnsMonitoringTab />}
    </div>
  )
}
