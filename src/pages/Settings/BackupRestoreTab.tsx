import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Download, Upload, Database, Clock, Trash2, RefreshCw, HardDrive } from 'lucide-react'

interface Backup {
  id: string
  name: string
  type: 'manual' | 'scheduled'
  size: string
  createdAt: string
  description?: string
}

export default function BackupRestoreTab() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backups, setBackups] = useState<Backup[]>([])
  const [showCreateBackup, setShowCreateBackup] = useState(false)

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    backupSchedule: 'daily',
    backupTime: '02:00',
    retentionDays: '30',
    backupLocation: '/var/backups/kea',
    includeConfig: true,
    includeDatabase: true,
    includeLogs: false,
    compression: true
  })

  const [backupForm, setBackupForm] = useState({
    name: '',
    description: '',
    includeConfig: true,
    includeDatabase: true,
    includeLogs: false
  })

  useEffect(() => {
    loadBackups()
    loadBackupSettings()
  }, [])

  const loadBackups = async () => {
    setLoading(true)
    try {
      // TODO: Load backups from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data
      const mockBackups: Backup[] = [
        {
          id: '1',
          name: 'kea-backup-2024-01-15',
          type: 'scheduled',
          size: '45.2 MB',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          description: 'Daily automated backup'
        },
        {
          id: '2',
          name: 'pre-upgrade-backup',
          type: 'manual',
          size: '43.8 MB',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          description: 'Backup before system upgrade'
        },
        {
          id: '3',
          name: 'kea-backup-2024-01-14',
          type: 'scheduled',
          size: '44.1 MB',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          description: 'Daily automated backup'
        }
      ]
      
      setBackups(mockBackups)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load backups' })
    } finally {
      setLoading(false)
    }
  }

  const loadBackupSettings = async () => {
    try {
      // TODO: Load backup settings from API
      await new Promise(resolve => setTimeout(resolve, 500))
      // Settings would be loaded here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load backup settings' })
    }
  }

  const handleCreateBackup = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Create backup via API
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      setMessage({ type: 'success', text: 'Backup created successfully' })
      setShowCreateBackup(false)
      setBackupForm({
        name: '',
        description: '',
        includeConfig: true,
        includeDatabase: true,
        includeLogs: false
      })
      await loadBackups()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create backup' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackup = async (backupId: string, backupName: string) => {
    setLoading(true)
    try {
      // TODO: Download backup via API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate file download
      const link = document.createElement('a')
      link.href = '#'
      link.download = `${backupName}.tar.gz`
      link.click()
      
      setMessage({ type: 'success', text: 'Backup download started' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to download backup' })
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreBackup = async (backupId: string, backupName: string) => {
    if (!confirm(`Are you sure you want to restore from "${backupName}"? This will overwrite current data and configuration.`)) {
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // TODO: Restore backup via API
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      setMessage({ type: 'success', text: 'Backup restored successfully. Server restart may be required.' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to restore backup' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBackup = async (backupId: string, backupName: string) => {
    if (!confirm(`Are you sure you want to delete backup "${backupName}"? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      // TODO: Delete backup via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'Backup deleted successfully' })
      await loadBackups()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete backup' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Save backup settings via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'Backup settings saved successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save backup settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm(`Are you sure you want to restore from "${file.name}"? This will overwrite current data and configuration.`)) {
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // TODO: Upload and restore backup via API
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      setMessage({ type: 'success', text: 'Backup uploaded and restored successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to upload and restore backup' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic backups and retention policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Automatic Backups</label>
              <p className="text-xs text-muted-foreground">Enable scheduled automatic backups</p>
            </div>
            <input
              type="checkbox"
              checked={backupSettings.autoBackup}
              onChange={(e) => setBackupSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
              className="h-4 w-4"
            />
          </div>

          {backupSettings.autoBackup && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Schedule</label>
                <Select
                  value={backupSettings.backupSchedule}
                  onChange={(e) => setBackupSettings(prev => ({ ...prev, backupSchedule: e.target.value }))}
                  className="mt-1"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Backup Time</label>
                <Input
                  type="time"
                  value={backupSettings.backupTime}
                  onChange={(e) => setBackupSettings(prev => ({ ...prev, backupTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Retention (days)</label>
                <Input
                  type="number"
                  value={backupSettings.retentionDays}
                  onChange={(e) => setBackupSettings(prev => ({ ...prev, retentionDays: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Backup Location</label>
            <Input
              value={backupSettings.backupLocation}
              onChange={(e) => setBackupSettings(prev => ({ ...prev, backupLocation: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Backup Contents</h4>
            {Object.entries({
              includeConfig: 'Include Configuration Files',
              includeDatabase: 'Include Database',
              includeLogs: 'Include Log Files',
              compression: 'Enable Compression'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="checkbox"
                  checked={backupSettings[key as keyof typeof backupSettings] as boolean}
                  onChange={(e) => setBackupSettings(prev => ({
                    ...prev,
                    [key]: e.target.checked
                  }))}
                  className="h-4 w-4"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Manual Backup
          </CardTitle>
          <CardDescription>
            Create a backup immediately or restore from a backup file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={() => setShowCreateBackup(true)} disabled={loading}>
              <Database className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
            <div>
              <input
                type="file"
                accept=".tar.gz,.zip,.tar"
                onChange={handleFileUpload}
                className="hidden"
                id="backup-upload"
                disabled={loading}
              />
              <Button variant="outline" asChild disabled={loading}>
                <label htmlFor="backup-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Restore from File
                </label>
              </Button>
            </div>
          </div>

          {showCreateBackup && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Create New Backup</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Backup Name</label>
                  <Input
                    value={backupForm.name}
                    onChange={(e) => setBackupForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter backup name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={backupForm.description}
                    onChange={(e) => setBackupForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Include in Backup</h5>
                {Object.entries({
                  includeConfig: 'Configuration Files',
                  includeDatabase: 'Database',
                  includeLogs: 'Log Files'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={backupForm[key as keyof typeof backupForm] as boolean}
                      onChange={(e) => setBackupForm(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }))}
                      className="h-4 w-4"
                    />
                    <label className="text-sm">{label}</label>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateBackup} disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Backup'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBackup(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            View and manage existing backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backups.map(backup => (
              <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{backup.name}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      backup.type === 'manual' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {backup.type}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {backup.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Size: {backup.size} • Created: {new Date(backup.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadBackup(backup.id, backup.name)}
                    disabled={loading}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreBackup(backup.id, backup.name)}
                    disabled={loading}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteBackup(backup.id, backup.name)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
