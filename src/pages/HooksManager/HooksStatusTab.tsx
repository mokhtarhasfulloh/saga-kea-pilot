import { useEffect, useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface HookStatus {
  library: string
  loaded: boolean
  error?: string
  version?: string
  commands?: string[]
}

export default function HooksStatusTab() {
  const [hookStatuses, setHookStatuses] = useState<HookStatus[]>([])
  const [availableCommands, setAvailableCommands] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function loadHookStatus() {
    setLoading(true)
    setError('')
    try {
      // Get list of available commands to determine which hooks are loaded
      const commandsResult = await caCall('list-commands', 'dhcp4')
      if (commandsResult.result === 0 && commandsResult.arguments) {
        setAvailableCommands(commandsResult.arguments)
      }

      // Get version info which includes hook information
      const versionResult = await caCall('version-get', 'dhcp4')
      if (versionResult.result === 0) {
        // For now, we'll infer hook status from available commands
        const hookStatuses: HookStatus[] = [
          {
            library: 'libdhcp_subnet_cmds.so',
            loaded: availableCommands.some(cmd => ['subnet4-add', 'subnet4-del', 'subnet4-update'].includes(cmd)),
            commands: availableCommands.filter(cmd => cmd.includes('subnet'))
          },
          {
            library: 'libdhcp_host_cmds.so',
            loaded: availableCommands.some(cmd => ['reservation-add', 'reservation-del'].includes(cmd)),
            commands: availableCommands.filter(cmd => cmd.includes('reservation'))
          },
          {
            library: 'libdhcp_lease_cmds.so',
            loaded: availableCommands.some(cmd => ['lease4-get', 'lease4-get-all'].includes(cmd)),
            commands: availableCommands.filter(cmd => cmd.includes('lease'))
          },
          {
            library: 'libdhcp_stat_cmds.so',
            loaded: availableCommands.some(cmd => ['statistic-get', 'statistic-get-all'].includes(cmd)),
            commands: availableCommands.filter(cmd => cmd.includes('statistic'))
          },
          {
            library: 'libdhcp_ha.so',
            loaded: availableCommands.some(cmd => ['ha-heartbeat', 'ha-sync'].includes(cmd)),
            commands: availableCommands.filter(cmd => cmd.includes('ha-'))
          }
        ]

        setHookStatuses(hookStatuses)
      }
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshStatus() {
    setRefreshing(true)
    await loadHookStatus()
    setRefreshing(false)
  }

  async function testCommand(command: string) {
    try {
      const result = await caCall(command, 'dhcp4')
      alert(`Command '${command}' executed successfully. Result: ${result.result}`)
    } catch (e: any) {
      alert(`Command '${command}' failed: ${String(e)}`)
    }
  }

  useEffect(() => {
    loadHookStatus()
  }, [])

  function getHookName(library: string): string {
    const name = library.replace(/^lib|\.so$/g, '').replace(/_/g, ' ')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  function getHookDescription(library: string): string {
    switch (library) {
      case 'libdhcp_subnet_cmds.so':
        return 'Runtime subnet and pool management'
      case 'libdhcp_host_cmds.so':
        return 'Host reservation management'
      case 'libdhcp_lease_cmds.so':
        return 'Lease query and management'
      case 'libdhcp_stat_cmds.so':
        return 'Statistics collection and reporting'
      case 'libdhcp_ha.so':
        return 'High availability and failover'
      default:
        return 'Custom hook library'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading hook status...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Hook Library Status</h2>
          <p className="text-sm text-gray-600">
            Monitor loaded hook libraries and available commands
          </p>
        </div>
        <Button onClick={refreshStatus} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Hook Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {hookStatuses.filter(h => h.loaded).length}
            </div>
            <div className="text-sm text-gray-600">Loaded Hooks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {availableCommands.length}
            </div>
            <div className="text-sm text-gray-600">Available Commands</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {hookStatuses.filter(h => !h.loaded).length}
            </div>
            <div className="text-sm text-gray-600">Not Loaded</div>
          </CardContent>
        </Card>
      </div>

      {/* Hook Status Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Hook Library Details</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Hook Library</Th>
                <Th>Status</Th>
                <Th>Description</Th>
                <Th>Commands</Th>
              </Tr>
            </Thead>
            <Tbody>
              {hookStatuses.map((hook, i) => (
                <Tr key={i}>
                  <Td>
                    <div className="font-medium">{getHookName(hook.library)}</div>
                    <div className="text-sm text-gray-600 font-mono">{hook.library}</div>
                  </Td>
                  <Td>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        hook.loaded ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className={hook.loaded ? 'text-green-600' : 'text-gray-500'}>
                        {hook.loaded ? 'Loaded' : 'Not Loaded'}
                      </span>
                    </div>
                    {hook.error && (
                      <div className="text-xs text-red-600 mt-1">{hook.error}</div>
                    )}
                  </Td>
                  <Td className="text-sm text-gray-600">
                    {getHookDescription(hook.library)}
                  </Td>
                  <Td>
                    {hook.commands && hook.commands.length > 0 ? (
                      <div className="text-sm">
                        <div className="font-medium">{hook.commands.length} command{hook.commands.length !== 1 ? 's' : ''}</div>
                        <div className="text-xs text-gray-500">
                          {hook.commands.slice(0, 3).join(', ')}
                          {hook.commands.length > 3 && '...'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Available Commands */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Available Commands</h3>
        </CardHeader>
        <CardContent>
          {availableCommands.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {availableCommands.map((command, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-mono text-sm">{command}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testCommand(command)}
                    className="ml-2"
                  >
                    Test
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">No Commands Available</div>
              <div className="text-sm">No hook libraries are loaded or server is not responding</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hook Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Hook Status Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Loaded Status:</strong> Indicates if hook library is successfully loaded</div>
          <div>• <strong>Available Commands:</strong> Commands provided by loaded hook libraries</div>
          <div>• <strong>Test Commands:</strong> Use test buttons to verify hook functionality</div>
          <div>• <strong>Troubleshooting:</strong> Check Kea logs if hooks fail to load</div>
          <div>• <strong>Dependencies:</strong> Some hooks require specific Kea versions or database backends</div>
        </div>
      </div>
    </div>
  )
}
