import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import UserProfileTab from './UserProfileTab'
import SystemPreferencesTab from './SystemPreferencesTab'
import ServerConfigTab from './ServerConfigTab'
import UserManagementTab from './UserManagementTab'
import SecurityTab from './SecurityTab'
import BackupRestoreTab from './BackupRestoreTab'
import LoggingTab from './LoggingTab'

const tabs = [
  'Profile',
  'Preferences', 
  'Server Config',
  'User Management',
  'Security',
  'Backup & Restore',
  'Logging'
] as const

type Tab = typeof tabs[number]

export default function Settings() {
  const [tab, setTab] = useState<Tab>('Profile')
  const { hasPermission } = useAuth()

  // Filter tabs based on permissions
  const availableTabs = tabs.filter(t => {
    if (t === 'User Management' || t === 'Server Config' || t === 'Security' || t === 'Backup & Restore' || t === 'Logging') {
      return hasPermission('canManageConfig')
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account, system preferences, and server configuration.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {availableTabs.map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Profile' && <UserProfileTab />}
        {tab === 'Preferences' && <SystemPreferencesTab />}
        {tab === 'Server Config' && hasPermission('canManageConfig') && <ServerConfigTab />}
        {tab === 'User Management' && hasPermission('canManageConfig') && <UserManagementTab />}
        {tab === 'Security' && hasPermission('canManageConfig') && <SecurityTab />}
        {tab === 'Backup & Restore' && hasPermission('canManageConfig') && <BackupRestoreTab />}
        {tab === 'Logging' && hasPermission('canManageConfig') && <LoggingTab />}
      </div>
    </div>
  )
}
