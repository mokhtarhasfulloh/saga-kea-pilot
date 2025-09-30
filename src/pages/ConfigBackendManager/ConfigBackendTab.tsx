import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import Select from '../../components/ui/select'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'

interface ConfigBackend {
  type: 'mysql' | 'postgresql'
  host?: string
  port?: number
  name?: string
  user?: string
  password?: string
  'readonly'?: boolean
  'connect-timeout'?: number
  'request-timeout'?: number
  'tcp-keepalive'?: boolean
}

export default function ConfigBackendTab() {
  const [configBackend, setConfigBackend] = useState<ConfigBackend | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [backendType, setBackendType] = useState<'mysql' | 'postgresql'>('postgresql')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState(5432)
  const [database, setDatabase] = useState('kea')
  const [username, setUsername] = useState('kea')
  const [password, setPassword] = useState('')
  const [readonly, setReadonly] = useState(false)
  const [connectTimeout, setConnectTimeout] = useState(5)
  const [requestTimeout, setRequestTimeout] = useState(30)
  const [tcpKeepalive, setTcpKeepalive] = useState(true)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}
      
      if (dhcp4['config-control'] && dhcp4['config-control']['config-databases']) {
        const backend = dhcp4['config-control']['config-databases'][0]
        setConfigBackend(backend)
        
        // Populate form with current values
        setBackendType(backend.type)
        setHost(backend.host || 'localhost')
        setPort(backend.port || (backend.type === 'mysql' ? 3306 : 5432))
        setDatabase(backend.name || 'kea')
        setUsername(backend.user || 'kea')
        setPassword(backend.password || '')
        setReadonly(backend.readonly || false)
        setConnectTimeout(backend['connect-timeout'] || 5)
        setRequestTimeout(backend['request-timeout'] || 30)
        setTcpKeepalive(backend['tcp-keepalive'] !== false)
      } else {
        setConfigBackend(null)
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openForm() {
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function closeForm() {
    setShowForm(false)
    setError('')
    setSuccess('')
  }

  async function saveConfigBackend() {
    if (!host.trim() || !database.trim() || !username.trim()) {
      setError('Host, database, and username are required')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      const backendConfig: ConfigBackend = {
        type: backendType,
        host: host.trim(),
        port,
        name: database.trim(),
        user: username.trim(),
        ...(password.trim() && { password: password.trim() }),
        readonly,
        'connect-timeout': connectTimeout,
        'request-timeout': requestTimeout,
        'tcp-keepalive': tcpKeepalive
      }

      const updatedConfig = {
        ...dhcp4,
        'config-control': {
          'config-databases': [backendConfig],
          'config-fetch-wait-time': 20
        }
      }

      await Kea.action('config-test', { Dhcp4: updatedConfig })
      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      setSuccess('Config backend configured successfully')
      closeForm()
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function disableConfigBackend() {
    if (!confirm('Disable config backend? This will remove database configuration storage.')) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || {}

      // Remove config-control section
      const updatedConfig = { ...dhcp4 }
      delete updatedConfig['config-control']

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')

      setSuccess('Config backend disabled successfully')
      loadData()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Test the connection by attempting to fetch config
      const result = await Kea.actionDhcp6('config-backend-pull')
      if (result) {
        setSuccess('Database connection test successful')
      }
    } catch (e: any) {
      setError(`Connection test failed: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading config backend settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Config Backend Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure database backend for centralized configuration storage
          </p>
        </div>
        <div className="flex gap-2">
          {configBackend && (
            <>
              <Button 
                variant="outline" 
                onClick={testConnection} 
                disabled={saving}
              >
                Test Connection
              </Button>
              <Button 
                variant="destructive" 
                onClick={disableConfigBackend} 
                disabled={saving}
              >
                Disable Backend
              </Button>
            </>
          )}
          <Button 
            onClick={openForm} 
            disabled={saving}
          >
            {configBackend ? 'Edit Backend' : 'Enable Backend'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Current Backend Status */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Current Backend Status</h3>
        </CardHeader>
        <CardContent>
          {configBackend ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Database Type</div>
                  <div className="text-sm text-muted-foreground capitalize">{configBackend.type}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Host</div>
                  <div className="text-sm text-muted-foreground">{configBackend.host}:{configBackend.port}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Database</div>
                  <div className="text-sm text-muted-foreground">{configBackend.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">User</div>
                  <div className="text-sm text-muted-foreground">{configBackend.user}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Mode</div>
                  <div className="text-sm text-muted-foreground">
                    {configBackend.readonly ? 'Read-only' : 'Read-write'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Timeouts</div>
                  <div className="text-sm text-gray-600">
                    Connect: {configBackend['connect-timeout']}s, Request: {configBackend['request-timeout']}s
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-600">Config backend is enabled</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">Config Backend Not Configured</div>
              <div className="text-sm">Enable database backend for centralized configuration management</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {configBackend ? 'Edit' : 'Configure'} Config Backend
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Database Type *
                </label>
                <Select
                  value={backendType}
                  onChange={e => {
                    setBackendType(e.target.value as any)
                    setPort(e.target.value === 'mysql' ? 3306 : 5432)
                  }}
                  disabled={saving}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Host *
                  </label>
                  <Input
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    placeholder="localhost"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Port *
                  </label>
                  <Input
                    type="number"
                    value={port}
                    onChange={e => setPort(parseInt(e.target.value) || 5432)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Database Name *
                </label>
                <Input
                  value={database}
                  onChange={e => setDatabase(e.target.value)}
                  placeholder="kea"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Username *
                  </label>
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="kea"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Leave empty to use current"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Connect Timeout (seconds)
                  </label>
                  <Input
                    type="number"
                    value={connectTimeout}
                    onChange={e => setConnectTimeout(parseInt(e.target.value) || 5)}
                    min={1}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Request Timeout (seconds)
                  </label>
                  <Input
                    type="number"
                    value={requestTimeout}
                    onChange={e => setRequestTimeout(parseInt(e.target.value) || 30)}
                    min={1}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={readonly}
                    onChange={e => setReadonly(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm font-medium">Read-only mode</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={tcpKeepalive}
                    onChange={e => setTcpKeepalive(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="text-sm font-medium">TCP Keep-alive</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveConfigBackend} disabled={saving || !host.trim()}>
                {saving ? 'Saving...' : 'Save Backend'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Config Backend Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Config Backend Benefits</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Centralized Storage:</strong> Store configuration in database instead of files</div>
          <div>• <strong>Multi-Server:</strong> Share configuration across multiple Kea instances</div>
          <div>• <strong>Runtime Changes:</strong> Modify configuration without file edits</div>
          <div>• <strong>Version Control:</strong> Track configuration changes and rollback</div>
          <div>• <strong>High Availability:</strong> Essential for HA setups with shared config</div>
          <div>• <strong>API Management:</strong> Use remote-* commands for configuration updates</div>
        </div>
      </div>
    </div>
  )
}
