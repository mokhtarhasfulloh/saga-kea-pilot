import { useState } from 'react'
import SubnetsTab from './SubnetsTab.tsx'
import SharedNetworksTab from './SharedNetworksTab.tsx'
import ClientClassesTab from './ClientClassesTab.tsx'
import ServerBehaviorTab from './ServerBehaviorTab.tsx'
import ReservationsTab from './ReservationsTab.tsx'
import ReservationsDbTab from './ReservationsDbTab.tsx'
import LeasesTab from './LeasesTab.tsx'
import LeaseOperationsTab from './LeaseOperationsTab.tsx'
import ActionsTab from './ActionsTab.tsx'
import OptionsTab from './OptionsTab.tsx'

const tabs = ['Subnets','Shared Networks','Client Classes','Server Behavior','Reservations','Reservations DB','Leases','Lease Ops','Options','Actions'] as const

type Tab = typeof tabs[number]

export default function DhcpManager() {
  const [tab, setTab] = useState<Tab>('Subnets')
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">DHCP Manager</h2>
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded border transition-colors ${tab===t? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>{t}</button>
        ))}
      </div>
      {tab==='Subnets' && <SubnetsTab />}
      {tab==='Shared Networks' && <SharedNetworksTab />}
      {tab==='Client Classes' && <ClientClassesTab />}
      {tab==='Server Behavior' && <ServerBehaviorTab />}
      {tab==='Reservations' && <ReservationsTab />}
      {tab==='Reservations DB' && <ReservationsDbTab />}
      {tab==='Leases' && <LeasesTab />}
      {tab==='Lease Ops' && <LeaseOperationsTab />}
      {tab==='Options' && <OptionsTab />}
      {tab==='Actions' && <ActionsTab />}
    </div>
  )
}

