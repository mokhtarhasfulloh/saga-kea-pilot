import { useState } from 'react'
import Subnets6Tab from './Subnets6Tab.tsx'
import PrefixDelegationTab from './PrefixDelegationTab.tsx'
import Options6Tab from './Options6Tab.tsx'
import Reservations6Tab from './Reservations6Tab.tsx'
import Leases6Tab from './Leases6Tab.tsx'
import Actions6Tab from './Actions6Tab.tsx'

const tabs = ['Subnets6','Prefix Delegation','Options6','Reservations6','Leases6','Actions6'] as const

type Tab = typeof tabs[number]

export default function Dhcpv6Manager() {
  const [tab, setTab] = useState<Tab>('Subnets6')
  
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">DHCPv6 Manager</h2>
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
      {tab==='Subnets6' && <Subnets6Tab />}
      {tab==='Prefix Delegation' && <PrefixDelegationTab />}
      {tab==='Options6' && <Options6Tab />}
      {tab==='Reservations6' && <Reservations6Tab />}
      {tab==='Leases6' && <Leases6Tab />}
      {tab==='Actions6' && <Actions6Tab />}
    </div>
  )
}
