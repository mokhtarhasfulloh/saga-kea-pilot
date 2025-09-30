import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { FileText, Download, Trash2, RefreshCw, Filter, Search } from 'lucide-react'

interface LogFile {
  id: string
  name: string
  size: string
  lastModified: string
  type: 'kea-dhcp4' | 'kea-dhcp6' | 'kea-ctrl-agent' | 'system' | 'audit'
}

export default function LoggingTab() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [logContent, setLogContent] = useState('')
  const [selectedLogFile, setSelectedLogFile] = useState<string>('')
  const [logFilter, setLogFilter] = useState('')

  const [loggingSettings, setLoggingSettings] = useState({
    dhcp4: {
      enabled: true,
      level: 'INFO',
      file: '/var/log/kea/kea-dhcp4.log',
      maxSize: '100',
      maxFiles: '10'
    },
    dhcp6: {
      enabled: true,
      level: 'INFO',
      file: '/var/log/kea/kea-dhcp6.log',
      maxSize: '100',
      maxFiles: '10'
    },
    ctrlAgent: {
      enabled: true,
      level: 'INFO',
      file: '/var/log/kea/kea-ctrl-agent.log',
      maxSize: '50',
      maxFiles: '5'
    },
    audit: {
      enabled: true,
      level: 'INFO',
      file: '/var/log/kea/audit.log',
      maxSize: '200',
      maxFiles: '20'
    },
    syslog: {
      enabled: false,
      facility: 'local0',
      tag: 'kea'
    }
  })

  useEffect(() => {
    loadLogFiles()
    loadLoggingSettings()
  }, [])

  const loadLogFiles = async () => {
    setLoading(true)
    try {
      // TODO: Load log files from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data
      const mockLogFiles: LogFile[] = [
        {
          id: '1',
          name: 'kea-dhcp4.log',
          size: '2.3 MB',
          lastModified: new Date(Date.now() - 3600000).toISOString(),
          type: 'kea-dhcp4'
        },
        {
          id: '2',
          name: 'kea-dhcp6.log',
          size: '1.8 MB',
          lastModified: new Date(Date.now() - 7200000).toISOString(),
          type: 'kea-dhcp6'
        },
        {
          id: '3',
          name: 'kea-ctrl-agent.log',
          size: '512 KB',
          lastModified: new Date(Date.now() - 1800000).toISOString(),
          type: 'kea-ctrl-agent'
        },
        {
          id: '4',
          name: 'audit.log',
          size: '4.1 MB',
          lastModified: new Date(Date.now() - 900000).toISOString(),
          type: 'audit'
        }
      ]
      
      setLogFiles(mockLogFiles)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load log files' })
    } finally {
      setLoading(false)
    }
  }

  const loadLoggingSettings = async () => {
    try {
      // TODO: Load logging settings from API
      await new Promise(resolve => setTimeout(resolve, 500))
      // Settings would be loaded here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load logging settings' })
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Save logging settings via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'Logging settings saved successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save logging settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleViewLog = async (logFileId: string) => {
    setLoading(true)
    setSelectedLogFile(logFileId)
    try {
      // TODO: Load log content from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock log content
      const mockLogContent = `2024-01-15 10:30:15.123 INFO  [kea-dhcp4.dhcp4] DHCP4_STARTED Kea DHCPv4 server version 2.4.1 started
2024-01-15 10:30:15.124 INFO  [kea-dhcp4.dhcp4] DHCP4_CONFIG_COMPLETE DHCPv4 server has completed configuration: added 3 subnets
2024-01-15 10:30:15.125 INFO  [kea-dhcp4.dhcp4] DHCP4_OPEN_SOCKET opening service sockets on port 67
2024-01-15 10:30:16.001 INFO  [kea-dhcp4.dhcp4] DHCP4_DISCOVER_RECEIVED DHCPDISCOVER from 00:11:22:33:44:55 via 192.168.1.1
2024-01-15 10:30:16.002 INFO  [kea-dhcp4.dhcp4] DHCP4_OFFER_SENT DHCPOFFER to 00:11:22:33:44:55 via 192.168.1.1: 192.168.1.100
2024-01-15 10:30:16.150 INFO  [kea-dhcp4.dhcp4] DHCP4_REQUEST_RECEIVED DHCPREQUEST from 00:11:22:33:44:55 via 192.168.1.1
2024-01-15 10:30:16.151 INFO  [kea-dhcp4.dhcp4] DHCP4_ACK_SENT DHCPACK to 00:11:22:33:44:55 via 192.168.1.1: 192.168.1.100
2024-01-15 10:30:16.152 INFO  [kea-dhcp4.dhcp4] DHCP4_LEASE_ALLOC lease 192.168.1.100 has been allocated for 3600 seconds
2024-01-15 10:31:22.456 WARN  [kea-dhcp4.dhcp4] DHCP4_SUBNET_SELECTION_FAILED failed to select subnet for client 00:aa:bb:cc:dd:ee
2024-01-15 10:31:22.457 INFO  [kea-dhcp4.dhcp4] DHCP4_NAK_SENT DHCPNAK sent to 00:aa:bb:cc:dd:ee via 192.168.1.1`
      
      setLogContent(mockLogContent)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load log content' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadLog = async (logFileId: string, fileName: string) => {
    setLoading(true)
    try {
      // TODO: Download log file via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Simulate file download
      const link = document.createElement('a')
      link.href = '#'
      link.download = fileName
      link.click()
      
      setMessage({ type: 'success', text: 'Log file download started' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to download log file' })
    } finally {
      setLoading(false)
    }
  }

  const handleClearLog = async (logFileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to clear the log file "${fileName}"? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      // TODO: Clear log file via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'Log file cleared successfully' })
      if (selectedLogFile === logFileId) {
        setLogContent('')
      }
      await loadLogFiles()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to clear log file' })
    } finally {
      setLoading(false)
    }
  }

  const getLogTypeColor = (type: LogFile['type']) => {
    switch (type) {
      case 'kea-dhcp4': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'kea-dhcp6': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'kea-ctrl-agent': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'audit': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'system': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const filteredLogContent = logContent
    .split('\n')
    .filter(line => logFilter === '' || line.toLowerCase().includes(logFilter.toLowerCase()))
    .join('\n')

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Logging Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logging Configuration
          </CardTitle>
          <CardDescription>
            Configure log levels and file settings for different components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(loggingSettings).map(([component, settings]) => {
            if (component === 'syslog') {
              return (
                <div key={component} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Syslog Integration</h4>
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(e) => setLoggingSettings(prev => ({
                        ...prev,
                        [component]: { ...prev[component], enabled: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  {settings.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Facility</label>
                        <Select
                          value={(settings as any).facility}
                          onChange={(e) => setLoggingSettings(prev => ({
                            ...prev,
                            [component]: { ...prev[component], facility: e.target.value }
                          }))}
                          className="mt-1"
                        >
                          <option value="local0">local0</option>
                          <option value="local1">local1</option>
                          <option value="local2">local2</option>
                          <option value="local3">local3</option>
                          <option value="local4">local4</option>
                          <option value="local5">local5</option>
                          <option value="local6">local6</option>
                          <option value="local7">local7</option>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Tag</label>
                        <Input
                          value={(settings as any).tag}
                          onChange={(e) => setLoggingSettings(prev => ({
                            ...prev,
                            [component]: { ...prev[component], tag: e.target.value }
                          }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={component} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    {component === 'dhcp4' && 'DHCP v4 Server'}
                    {component === 'dhcp6' && 'DHCP v6 Server'}
                    {component === 'ctrlAgent' && 'Control Agent'}
                    {component === 'audit' && 'Audit Logs'}
                  </h4>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setLoggingSettings(prev => ({
                      ...prev,
                      [component]: { ...prev[component], enabled: e.target.checked }
                    }))}
                    className="h-4 w-4"
                  />
                </div>
                {settings.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium">Log Level</label>
                      <Select
                        value={(settings as any).level}
                        onChange={(e) => setLoggingSettings(prev => ({
                          ...prev,
                          [component]: { ...prev[component], level: e.target.value }
                        }))}
                        className="mt-1"
                      >
                        <option value="FATAL">FATAL</option>
                        <option value="ERROR">ERROR</option>
                        <option value="WARN">WARN</option>
                        <option value="INFO">INFO</option>
                        <option value="DEBUG">DEBUG</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Log File</label>
                      <Input
                        value={(settings as any).file}
                        onChange={(e) => setLoggingSettings(prev => ({
                          ...prev,
                          [component]: { ...prev[component], file: e.target.value }
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Size (MB)</label>
                      <Input
                        type="number"
                        value={(settings as any).maxSize}
                        onChange={(e) => setLoggingSettings(prev => ({
                          ...prev,
                          [component]: { ...prev[component], maxSize: e.target.value }
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Files</label>
                      <Input
                        type="number"
                        value={(settings as any).maxFiles}
                        onChange={(e) => setLoggingSettings(prev => ({
                          ...prev,
                          [component]: { ...prev[component], maxFiles: e.target.value }
                        }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Logging Settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Files */}
      <Card>
        <CardHeader>
          <CardTitle>Log Files</CardTitle>
          <CardDescription>
            View, download, and manage log files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logFiles.map(logFile => (
              <div key={logFile.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{logFile.name}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getLogTypeColor(logFile.type)}`}>
                      {logFile.type}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Size: {logFile.size} • Last modified: {new Date(logFile.lastModified).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLog(logFile.id)}
                    disabled={loading}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadLog(logFile.id, logFile.name)}
                    disabled={loading}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClearLog(logFile.id, logFile.name)}
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

      {/* Log Viewer */}
      {selectedLogFile && (
        <Card>
          <CardHeader>
            <CardTitle>Log Viewer</CardTitle>
            <CardDescription>
              View log content with filtering capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Filter log entries..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => setLogFilter('')}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap">{filteredLogContent || 'No log content to display'}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
