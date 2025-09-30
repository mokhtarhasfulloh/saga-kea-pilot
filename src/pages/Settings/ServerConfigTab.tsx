import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Server, Network, Database, Settings, RefreshCw, AlertTriangle } from 'lucide-react'

export default function ServerConfigTab() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const [config, setConfig] = useState({
    server: {
      hostname: 'kea-server',
      listenAddress: '0.0.0.0',
      dhcpPort: '67',
      dhcpv6Port: '547',
      maxThreads: '4',
      logLevel: 'INFO'
    },
    database: {
      host: 'localhost',
      port: '5432',
      database: 'kea',
      username: 'kea',
      connectionPool: '10',
      timeout: '30'
    },
    network: {
      defaultLeaseTime: '3600',
      maxLeaseTime: '7200',
      renewTimer: '1800',
      rebindTimer: '3000',
      enableDdns: false,
      ddnsServer: '127.0.0.1'
    },
    advanced: {
      enableStatistics: true,
      statisticsInterval: '300',
      enableHooks: true,
      configBackend: 'database',
      enableHA: false,
      haMode: 'hot-standby'
    }
  })

  useEffect(() => {
    loadServerConfig()
  }, [])

  const loadServerConfig = async () => {
    setLoading(true)
    try {
      // TODO: Load actual server configuration from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Config would be loaded here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load server configuration' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = (section: keyof typeof config, key: string, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  const handleSaveConfig = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Save configuration via API
      await new Promise(resolve => setTimeout(resolve, 2000))
      setMessage({ type: 'success', text: 'Server configuration saved successfully. Restart required for some changes to take effect.' })
      setHasChanges(false)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save server configuration' })
    } finally {
      setLoading(false)
    }
  }

  const handleRestartServer = async () => {
    if (!confirm('Are you sure you want to restart the Kea server? This will temporarily interrupt DHCP services.')) {
      return
    }

    setLoading(true)
    try {
      // TODO: Restart server via API
      await new Promise(resolve => setTimeout(resolve, 3000))
      setMessage({ type: 'success', text: 'Server restarted successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to restart server' })
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

      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Don't forget to save your configuration.
          </AlertDescription>
        </Alert>
      )}

      {/* Server Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Settings
          </CardTitle>
          <CardDescription>
            Basic server configuration and listening parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Hostname</label>
              <Input
                value={config.server.hostname}
                onChange={(e) => handleConfigChange('server', 'hostname', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Listen Address</label>
              <Input
                value={config.server.listenAddress}
                onChange={(e) => handleConfigChange('server', 'listenAddress', e.target.value)}
                placeholder="0.0.0.0"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">DHCP Port</label>
              <Input
                type="number"
                value={config.server.dhcpPort}
                onChange={(e) => handleConfigChange('server', 'dhcpPort', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">DHCPv6 Port</label>
              <Input
                type="number"
                value={config.server.dhcpv6Port}
                onChange={(e) => handleConfigChange('server', 'dhcpv6Port', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max Threads</label>
              <Input
                type="number"
                value={config.server.maxThreads}
                onChange={(e) => handleConfigChange('server', 'maxThreads', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Log Level</label>
              <Select
                value={config.server.logLevel}
                onChange={(e) => handleConfigChange('server', 'logLevel', e.target.value)}
                className="mt-1"
              >
                <option value="FATAL">FATAL</option>
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
                <option value="DEBUG">DEBUG</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Configuration
          </CardTitle>
          <CardDescription>
            Database connection and performance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Host</label>
              <Input
                value={config.database.host}
                onChange={(e) => handleConfigChange('database', 'host', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Port</label>
              <Input
                type="number"
                value={config.database.port}
                onChange={(e) => handleConfigChange('database', 'port', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Database Name</label>
              <Input
                value={config.database.database}
                onChange={(e) => handleConfigChange('database', 'database', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Username</label>
              <Input
                value={config.database.username}
                onChange={(e) => handleConfigChange('database', 'username', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Connection Pool Size</label>
              <Input
                type="number"
                value={config.database.connectionPool}
                onChange={(e) => handleConfigChange('database', 'connectionPool', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Timeout (seconds)</label>
              <Input
                type="number"
                value={config.database.timeout}
                onChange={(e) => handleConfigChange('database', 'timeout', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Network Configuration
          </CardTitle>
          <CardDescription>
            DHCP lease timers and network behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Default Lease Time (seconds)</label>
              <Input
                type="number"
                value={config.network.defaultLeaseTime}
                onChange={(e) => handleConfigChange('network', 'defaultLeaseTime', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max Lease Time (seconds)</label>
              <Input
                type="number"
                value={config.network.maxLeaseTime}
                onChange={(e) => handleConfigChange('network', 'maxLeaseTime', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Renew Timer (seconds)</label>
              <Input
                type="number"
                value={config.network.renewTimer}
                onChange={(e) => handleConfigChange('network', 'renewTimer', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rebind Timer (seconds)</label>
              <Input
                type="number"
                value={config.network.rebindTimer}
                onChange={(e) => handleConfigChange('network', 'rebindTimer', e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.network.enableDdns}
                onChange={(e) => handleConfigChange('network', 'enableDdns', e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Enable Dynamic DNS</label>
            </div>
            <div>
              <label className="text-sm font-medium">DDNS Server</label>
              <Input
                value={config.network.ddnsServer}
                onChange={(e) => handleConfigChange('network', 'ddnsServer', e.target.value)}
                disabled={!config.network.enableDdns}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced Configuration
          </CardTitle>
          <CardDescription>
            Advanced features and high availability settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.advanced.enableStatistics}
                onChange={(e) => handleConfigChange('advanced', 'enableStatistics', e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Enable Statistics</label>
            </div>
            <div>
              <label className="text-sm font-medium">Statistics Interval (seconds)</label>
              <Input
                type="number"
                value={config.advanced.statisticsInterval}
                onChange={(e) => handleConfigChange('advanced', 'statisticsInterval', e.target.value)}
                disabled={!config.advanced.enableStatistics}
                className="mt-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.advanced.enableHooks}
                onChange={(e) => handleConfigChange('advanced', 'enableHooks', e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Enable Hooks</label>
            </div>
            <div>
              <label className="text-sm font-medium">Config Backend</label>
              <Select
                value={config.advanced.configBackend}
                onChange={(e) => handleConfigChange('advanced', 'configBackend', e.target.value)}
                className="mt-1"
              >
                <option value="file">File</option>
                <option value="database">Database</option>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.advanced.enableHA}
                onChange={(e) => handleConfigChange('advanced', 'enableHA', e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Enable High Availability</label>
            </div>
            <div>
              <label className="text-sm font-medium">HA Mode</label>
              <Select
                value={config.advanced.haMode}
                onChange={(e) => handleConfigChange('advanced', 'haMode', e.target.value)}
                disabled={!config.advanced.enableHA}
                className="mt-1"
              >
                <option value="hot-standby">Hot Standby</option>
                <option value="load-balancing">Load Balancing</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleRestartServer} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Restarting...
            </>
          ) : (
            'Restart Server'
          )}
        </Button>
        <Button onClick={handleSaveConfig} disabled={loading || !hasChanges}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>
    </div>
  )
}
