import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import { Alert } from '../../components/ui/alert'
import Button from '../../components/ui/button'
import ReservationsDbConfig, { ReservationsBulkOperations } from '../../components/dhcp/ReservationsDbConfig'

interface HostsDatabase {
  type: 'mysql' | 'postgresql'
  name: string
  host?: string
  port?: number
  user?: string
  password?: string
  readonly?: boolean
  'trust-anchor'?: string
  'cert-file'?: string
  'key-file'?: string
  'cipher-list'?: string
}

export default function ReservationsDbTab() {
  const [hostsDatabase, setHostsDatabase] = useState<HostsDatabase | undefined>()
  const [originalConfig, setOriginalConfig] = useState<HostsDatabase | undefined>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await Kea.configGet()
      const dhcp4 = response?.Dhcp4 || response
      
      const dbConfig = dhcp4['hosts-database']
      setHostsDatabase(dbConfig)
      setOriginalConfig(dbConfig)
      setHasChanges(false)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setHasChanges(JSON.stringify(hostsDatabase) !== JSON.stringify(originalConfig))
  }, [hostsDatabase, originalConfig])

  async function testConnection() {
    if (!hostsDatabase) {
      setError('No database configuration to test')
      return
    }

    setLoading(true)
    setError('')
    setConnectionStatus('unknown')

    try {
      // Create a test configuration
      const currentConfig = await Kea.configGet()
      const dhcp4 = currentConfig?.Dhcp4 || currentConfig
      
      const testConfig = {
        ...dhcp4,
        'hosts-database': hostsDatabase
      }

      // Test the configuration
      const result = await Kea.action('config-test', { Dhcp4: testConfig })
      
      if (result.result === 0) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('failed')
        setError(result.text || 'Configuration test failed')
      }
    } catch (e: any) {
      setConnectionStatus('failed')
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    setError('')
    try {
      const currentConfig = await Kea.configGet()
      const dhcp4 = currentConfig?.Dhcp4 || currentConfig
      
      // Update configuration with hosts database
      const updatedConfig = {
        ...dhcp4,
        ...(hostsDatabase ? { 'hosts-database': hostsDatabase } : {})
      }

      // Remove hosts-database if disabled
      if (!hostsDatabase) {
        delete updatedConfig['hosts-database']
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')
      
      setOriginalConfig(hostsDatabase)
      setHasChanges(false)
      setConnectionStatus('unknown')
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function resetConfig() {
    if (!confirm('Reset all changes to last saved configuration?')) return
    setHostsDatabase(originalConfig)
    setHasChanges(false)
    setConnectionStatus('unknown')
  }

  if (loading && !hostsDatabase) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading database configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Reservations Database Backend</h2>
          <p className="text-sm text-muted-foreground">
            Configure MySQL or PostgreSQL backend for host reservations storage
          </p>
        </div>
        <div className="flex gap-2">
          {hostsDatabase && (
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={loading || saving}
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </Button>
          )}
          {hasChanges && (
            <Button
              variant="outline"
              onClick={resetConfig}
              disabled={saving}
            >
              Reset Changes
            </Button>
          )}
          <Button
            onClick={saveConfig}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {hasChanges && (
        <Alert variant="warn">
          You have unsaved changes. Click "Save Configuration" to apply them.
        </Alert>
      )}

      {/* Connection Status */}
      {connectionStatus !== 'unknown' && (
        <Alert variant={connectionStatus === 'connected' ? 'success' : 'error'}>
          {connectionStatus === 'connected' 
            ? 'Database connection test successful!' 
            : 'Database connection test failed. Check configuration and database availability.'
          }
        </Alert>
      )}

      {/* Database Configuration */}
      <ReservationsDbConfig
        config={hostsDatabase}
        onChange={setHostsDatabase}
        disabled={saving}
      />

      {/* Bulk Operations */}
      {hostsDatabase && (
        <ReservationsBulkOperations disabled={saving} />
      )}

      {/* Current Status */}
      <div className="bg-muted border rounded p-4">
        <h3 className="font-medium mb-2">Current Configuration Status</h3>
        <div className="text-sm space-y-1">
          <div>
            <strong>Backend:</strong> {hostsDatabase ? `${hostsDatabase.type} database` : 'Configuration files'}
          </div>
          {hostsDatabase && (
            <>
              <div>
                <strong>Database:</strong> {hostsDatabase.name} on {hostsDatabase.host}:{hostsDatabase.port}
              </div>
              <div>
                <strong>Access Mode:</strong> {hostsDatabase.readonly ? 'Read-only' : 'Read-write'}
              </div>
            </>
          )}
          <div>
            <strong>Changes:</strong> {hasChanges ? 'Unsaved changes pending' : 'Configuration saved'}
          </div>
        </div>
      </div>

      {/* Migration Guide */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-400 mb-2">Migration Guide</h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <div>
            <strong>Step 1:</strong> Set up your database server (MySQL 5.7+ or PostgreSQL 9.5+)
          </div>
          <div>
            <strong>Step 2:</strong> Create the Kea database and install the schema using the provided scripts
          </div>
          <div>
            <strong>Step 3:</strong> Configure the database connection above and test it
          </div>
          <div>
            <strong>Step 4:</strong> Enable read-only mode initially to test without modifications
          </div>
          <div>
            <strong>Step 5:</strong> Migrate existing reservations using the bulk import feature
          </div>
          <div>
            <strong>Step 6:</strong> Switch to read-write mode for full functionality
          </div>
        </div>
      </div>

      {/* Performance Notes */}
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded p-4">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-400 mb-2">Performance Considerations</h3>
        <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <div>• Database backend provides better performance for large numbers of reservations (&gt;1000)</div>
          <div>• Use connection pooling and proper indexing for optimal performance</div>
          <div>• Consider database replication for high availability scenarios</div>
          <div>• Monitor database performance and tune queries as needed</div>
          <div>• Regular database maintenance (VACUUM, ANALYZE) is recommended</div>
        </div>
      </div>
    </div>
  )
}
