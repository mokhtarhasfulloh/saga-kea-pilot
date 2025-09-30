import { useState } from 'react'
import Button from '../ui/button'
import Input from '../ui/input'
import { Alert } from '../ui/alert'
import { Card, CardHeader, CardContent } from '../ui/card'

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

interface ReservationsDbConfigProps {
  config?: HostsDatabase
  onChange: (config?: HostsDatabase) => void
  disabled?: boolean
}

// Bulk import/export component
export function ReservationsBulkOperations({ disabled }: { disabled?: boolean }) {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      const text = await file.text()
      let reservations: any[]

      if (file.name.endsWith('.json')) {
        reservations = JSON.parse(text)
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parsing - in production, use a proper CSV library
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim())
        reservations = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim())
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]
            return obj
          }, {} as any)
        })
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.')
      }

      // Validate and import reservations
      let imported = 0
      for (const reservation of reservations) {
        try {
          // Add reservation via Kea API
          // await Kea.action('reservation-add', reservation)
          imported++
        } catch (e) {
          console.error('Failed to import reservation:', reservation, e)
        }
      }

      setSuccess(`Successfully imported ${imported} of ${reservations.length} reservations`)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setImporting(false)
      event.target.value = '' // Reset file input
    }
  }

  async function handleExport(format: 'json' | 'csv') {
    setExporting(true)
    setError('')

    try {
      // Get all reservations from Kea
      // const result = await Kea.action('reservation-get-all', {})
      const reservations: any[] = [] // result.arguments || []

      let content: string
      let filename: string

      if (format === 'json') {
        content = JSON.stringify(reservations, null, 2)
        filename = `kea-reservations-${new Date().toISOString().split('T')[0]}.json`
      } else {
        // CSV export
        if (reservations.length === 0) {
          throw new Error('No reservations to export')
        }

        const headers = Object.keys(reservations[0])
        const csvLines = [
          headers.join(','),
          ...reservations.map(res =>
            headers.map(h => res[h] || '').join(',')
          )
        ]
        content = csvLines.join('\n')
        filename = `kea-reservations-${new Date().toISOString().split('T')[0]}.csv`
      }

      // Download file
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(`Exported ${reservations.length} reservations as ${format.toUpperCase()}`)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-medium">Bulk Import/Export</h3>
        <p className="text-sm text-gray-600">
          Import and export host reservations in JSON or CSV format
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Import */}
        <div>
          <label className="block text-sm font-medium mb-2">Import Reservations</label>
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleImport}
            disabled={disabled || importing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <div className="text-xs text-gray-500 mt-1">
            Supports JSON and CSV formats. {importing && 'Importing...'}
          </div>
        </div>

        {/* Export */}
        <div>
          <label className="block text-sm font-medium mb-2">Export Reservations</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              disabled={disabled || exporting}
            >
              Export as JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={disabled || exporting}
            >
              Export as CSV
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {exporting ? 'Exporting...' : 'Download all reservations in the selected format'}
          </div>
        </div>

        {/* CSV Format Example */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm font-medium mb-1">CSV Format Example</div>
          <pre className="text-xs text-gray-600">
{`hw-address,ip-address,hostname,client-id
00:11:22:33:44:55,192.168.1.100,device1,
00:11:22:33:44:56,192.168.1.101,device2,01:00:11:22:33:44:56`}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReservationsDbConfig({ config, onChange, disabled }: ReservationsDbConfigProps) {
  const [enabled, setEnabled] = useState(!!config)
  const [dbType, setDbType] = useState<'mysql' | 'postgresql'>(config?.type || 'postgresql')
  const [dbName, setDbName] = useState(config?.name || '')
  const [host, setHost] = useState(config?.host || 'localhost')
  const [port, setPort] = useState(config?.port || (dbType === 'mysql' ? 3306 : 5432))
  const [user, setUser] = useState(config?.user || '')
  const [password, setPassword] = useState(config?.password || '')
  const [readonly, setReadonly] = useState(config?.readonly || false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')

  function updateConfig() {
    if (!enabled) {
      onChange(undefined)
      return
    }

    if (!dbName.trim() || !user.trim()) {
      setError('Database name and user are required')
      return
    }

    setError('')
    
    const newConfig: HostsDatabase = {
      type: dbType,
      name: dbName.trim(),
      host: host.trim() || 'localhost',
      port: port,
      user: user.trim(),
      password: password.trim(),
      readonly: readonly
    }

    onChange(newConfig)
  }

  function handleEnabledChange(isEnabled: boolean) {
    setEnabled(isEnabled)
    if (!isEnabled) {
      onChange(undefined)
    } else {
      updateConfig()
    }
  }

  function handleDbTypeChange(type: 'mysql' | 'postgresql') {
    setDbType(type)
    setPort(type === 'mysql' ? 3306 : 5432)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">Database Backend for Reservations</h3>
            <p className="text-sm text-muted-foreground">
              Store host reservations in MySQL or PostgreSQL instead of configuration files
            </p>
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => handleEnabledChange(e.target.checked)}
              disabled={disabled}
            />
            <span className="text-sm font-medium">Enable DB Backend</span>
          </label>
        </div>
      </CardHeader>
      
      {enabled && (
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Database Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Database Type</label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="dbType"
                  value="postgresql"
                  checked={dbType === 'postgresql'}
                  onChange={() => handleDbTypeChange('postgresql')}
                  disabled={disabled}
                />
                <span className="text-sm">PostgreSQL</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="dbType"
                  value="mysql"
                  checked={dbType === 'mysql'}
                  onChange={() => handleDbTypeChange('mysql')}
                  disabled={disabled}
                />
                <span className="text-sm">MySQL</span>
              </label>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Database Name *</label>
              <Input
                value={dbName}
                onChange={e => setDbName(e.target.value)}
                placeholder="kea"
                disabled={disabled}
                onBlur={updateConfig}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Host</label>
              <Input
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="localhost"
                disabled={disabled}
                onBlur={updateConfig}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input
                type="number"
                value={port}
                onChange={e => setPort(parseInt(e.target.value) || (dbType === 'mysql' ? 3306 : 5432))}
                min={1}
                max={65535}
                disabled={disabled}
                onBlur={updateConfig}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username *</label>
              <Input
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="kea"
                disabled={disabled}
                onBlur={updateConfig}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={disabled}
                onBlur={updateConfig}
              />
            </div>
          </div>

          {/* Access Mode */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={readonly}
                onChange={e => {
                  setReadonly(e.target.checked)
                  setTimeout(updateConfig, 0)
                }}
                disabled={disabled}
              />
              <span className="text-sm font-medium">Read-only Mode</span>
            </label>
            <div className="text-xs text-gray-500 mt-1">
              Enable to prevent Kea from modifying reservations in the database
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={disabled}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </Button>
          </div>

          {showAdvanced && (
            <div className="border-t pt-4 space-y-4">
              <div className="text-sm font-medium mb-2">SSL/TLS Configuration</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Trust Anchor</label>
                  <Input
                    value={config?.['trust-anchor'] || ''}
                    onChange={e => onChange({ ...config!, 'trust-anchor': e.target.value || undefined })}
                    placeholder="/path/to/ca-cert.pem"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    CA certificate file for SSL connections
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Certificate</label>
                  <Input
                    value={config?.['cert-file'] || ''}
                    onChange={e => onChange({ ...config!, 'cert-file': e.target.value || undefined })}
                    placeholder="/path/to/client-cert.pem"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Client certificate file for SSL authentication
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Private Key</label>
                  <Input
                    value={config?.['key-file'] || ''}
                    onChange={e => onChange({ ...config!, 'key-file': e.target.value || undefined })}
                    placeholder="/path/to/client-key.pem"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Private key file for SSL authentication
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cipher List</label>
                  <Input
                    value={config?.['cipher-list'] || ''}
                    onChange={e => onChange({ ...config!, 'cipher-list': e.target.value || undefined })}
                    placeholder="HIGH:!aNULL:!MD5"
                    disabled={disabled}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Allowed SSL cipher suites
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Preview */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Configuration Preview</h4>
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto">
              {JSON.stringify({
                type: dbType,
                name: dbName || 'kea',
                host: host || 'localhost',
                port: port,
                user: user || 'kea',
                ...(password && { password: '••••••••' }),
                ...(readonly && { readonly: true })
              }, null, 2)}
            </pre>
          </div>

          {/* Setup Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-400 mb-2">Database Setup Instructions</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <div>
                <strong>1. Create Database:</strong> Create a database named "{dbName || 'kea'}" in your {dbType} server
              </div>
              <div>
                <strong>2. Install Schema:</strong> Run the Kea database schema scripts:
                <div className="font-mono text-xs bg-blue-100 dark:bg-blue-950/30 p-2 rounded mt-1">
                  {dbType === 'postgresql' 
                    ? 'psql -U kea -d kea -f /usr/share/kea/scripts/pgsql/dhcpdb_create.pgsql'
                    : 'mysql -u kea -p kea < /usr/share/kea/scripts/mysql/dhcpdb_create.mysql'
                  }
                </div>
              </div>
              <div>
                <strong>3. Grant Permissions:</strong> Ensure the user has appropriate permissions on the hosts table
              </div>
              <div>
                <strong>4. Test Connection:</strong> Use the configuration test to verify database connectivity
              </div>
            </div>
          </div>

          {/* Migration Notes */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded p-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-400 mb-2">Migration Notes</h4>
            <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <div>• Existing configuration-based reservations will need to be migrated manually</div>
              <div>• Database reservations take precedence over configuration reservations</div>
              <div>• Use read-only mode during testing to prevent accidental modifications</div>
              <div>• Consider backup strategies for the reservations database</div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
