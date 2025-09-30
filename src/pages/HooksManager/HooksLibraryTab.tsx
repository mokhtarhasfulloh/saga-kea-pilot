import { useState } from 'react'
import Button from '../../components/ui/button'
// import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface HookLibraryInfo {
  name: string
  library: string
  description: string
  version: string
  status: 'available' | 'installed' | 'not-found'
  commands: string[]
  dependencies?: string[]
  documentation?: string
}

const HOOK_LIBRARY_CATALOG: HookLibraryInfo[] = [
  {
    name: 'Subnet Commands',
    library: 'libdhcp_subnet_cmds.so',
    description: 'Runtime subnet and pool management commands',
    version: '2.4.0+',
    status: 'available',
    commands: ['subnet4-add', 'subnet4-del', 'subnet4-update', 'subnet4-list', 'subnet4-get'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#subnet-cmds'
  },
  {
    name: 'Host Commands',
    library: 'libdhcp_host_cmds.so',
    description: 'Host reservation management commands',
    version: '1.2.0+',
    status: 'available',
    commands: ['reservation-add', 'reservation-del', 'reservation-get', 'reservation-get-all'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#host-cmds'
  },
  {
    name: 'Lease Commands',
    library: 'libdhcp_lease_cmds.so',
    description: 'Lease query and management commands',
    version: '1.2.0+',
    status: 'available',
    commands: ['lease4-get', 'lease4-get-all', 'lease4-get-page', 'lease4-add', 'lease4-del'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#lease-cmds'
  },
  {
    name: 'Statistics Commands',
    library: 'libdhcp_stat_cmds.so',
    description: 'Enhanced statistics collection and reporting',
    version: '1.4.0+',
    status: 'available',
    commands: ['statistic-get', 'statistic-get-all', 'statistic-reset', 'statistic-reset-all'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#stat-cmds'
  },
  {
    name: 'High Availability',
    library: 'libdhcp_ha.so',
    description: 'High availability and failover support',
    version: '1.4.0+',
    status: 'available',
    commands: ['ha-heartbeat', 'ha-sync', 'ha-reset', 'ha-maintenance-start', 'ha-maintenance-cancel'],
    dependencies: ['Database backend (MySQL/PostgreSQL)'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#ha'
  },
  {
    name: 'Forensic Logging',
    library: 'libdhcp_legal_log.so',
    description: 'Detailed forensic logging for compliance',
    version: '1.1.0+',
    status: 'available',
    commands: [],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#legal-log'
  },
  {
    name: 'Flex ID',
    library: 'libdhcp_flex_id.so',
    description: 'Flexible client identification',
    version: '1.2.0+',
    status: 'available',
    commands: [],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#flex-id'
  },
  {
    name: 'RADIUS',
    library: 'libdhcp_radius.so',
    description: 'RADIUS authentication and accounting',
    version: '1.4.0+',
    status: 'available',
    commands: [],
    dependencies: ['FreeRADIUS client library'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#radius'
  },
  {
    name: 'MySQL Config Backend',
    library: 'libdhcp_mysql_cb.so',
    description: 'MySQL configuration backend',
    version: '1.6.0+',
    status: 'available',
    commands: ['remote-subnet4-list', 'remote-subnet4-get', 'remote-subnet4-set'],
    dependencies: ['MySQL database', 'Config Backend enabled'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#mysql-cb'
  },
  {
    name: 'PostgreSQL Config Backend',
    library: 'libdhcp_pgsql_cb.so',
    description: 'PostgreSQL configuration backend',
    version: '1.6.0+',
    status: 'available',
    commands: ['remote-subnet4-list', 'remote-subnet4-get', 'remote-subnet4-set'],
    dependencies: ['PostgreSQL database', 'Config Backend enabled'],
    documentation: 'https://kea.readthedocs.io/en/latest/arm/hooks.html#pgsql-cb'
  }
]

export default function HooksLibraryTab() {
  const [selectedHook, setSelectedHook] = useState<HookLibraryInfo | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  function openDetails(hook: HookLibraryInfo) {
    setSelectedHook(hook)
    setShowDetails(true)
  }

  function closeDetails() {
    setShowDetails(false)
    setSelectedHook(null)
  }

  // function getStatusColor(status: string): string {
  //   switch (status) {
  //     case 'installed':
  //       return 'text-green-600'
  //     case 'available':
  //       return 'text-blue-600'
  //     case 'not-found':
  //       return 'text-red-600'
  //     default:
  //       return 'text-gray-600'
  //   }
  // }

  function getStatusBadge(status: string): string {
    switch (status) {
      case 'installed':
        return 'bg-green-100 text-green-800'
      case 'available':
        return 'bg-blue-100 text-blue-800'
      case 'not-found':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Hook Library Catalog</h2>
        <p className="text-sm text-gray-600">
          Browse available Kea hook libraries and their capabilities
        </p>
      </div>

      {/* Library Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {HOOK_LIBRARY_CATALOG.filter(h => h.commands.length > 0).length}
            </div>
            <div className="text-sm text-gray-600">Command Libraries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {HOOK_LIBRARY_CATALOG.filter(h => h.status === 'available').length}
            </div>
            <div className="text-sm text-gray-600">Available</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {HOOK_LIBRARY_CATALOG.filter(h => h.dependencies).length}
            </div>
            <div className="text-sm text-gray-600">With Dependencies</div>
          </CardContent>
        </Card>
      </div>

      {/* Hook Library Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Available Hook Libraries</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Commands</Th>
                <Th>Dependencies</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {HOOK_LIBRARY_CATALOG.map((hook, i) => (
                <Tr key={i}>
                  <Td>
                    <div className="font-medium">{hook.name}</div>
                    <div className="text-sm text-gray-600">{hook.description}</div>
                  </Td>
                  <Td className="text-sm">{hook.version}</Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(hook.status)}`}>
                      {hook.status.replace('-', ' ')}
                    </span>
                  </Td>
                  <Td>
                    {hook.commands.length > 0 ? (
                      <div className="text-sm">
                        <div className="font-medium">{hook.commands.length} command{hook.commands.length !== 1 ? 's' : ''}</div>
                        <div className="text-xs text-gray-500">
                          {hook.commands.slice(0, 2).join(', ')}
                          {hook.commands.length > 2 && '...'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </Td>
                  <Td>
                    {hook.dependencies ? (
                      <div className="text-xs text-gray-600">
                        {hook.dependencies.slice(0, 1).join(', ')}
                        {hook.dependencies.length > 1 && '...'}
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </Td>
                  <Td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetails(hook)}
                    >
                      Details
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Hook Details Modal */}
      {showDetails && selectedHook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedHook.name}</h3>
                <p className="text-sm text-gray-600">{selectedHook.description}</p>
              </div>
              <Button variant="outline" onClick={closeDetails}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Library File</div>
                  <div className="text-sm text-gray-600 font-mono">{selectedHook.library}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Minimum Version</div>
                  <div className="text-sm text-gray-600">{selectedHook.version}</div>
                </div>
              </div>

              {selectedHook.dependencies && (
                <div>
                  <div className="text-sm font-medium mb-2">Dependencies</div>
                  <div className="space-y-1">
                    {selectedHook.dependencies.map((dep, i) => (
                      <div key={i} className="text-sm text-gray-600 flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>{dep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedHook.commands.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Available Commands</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedHook.commands.map((command, i) => (
                      <div key={i} className="p-2 border rounded font-mono text-sm">
                        {command}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedHook.documentation && (
                <div>
                  <div className="text-sm font-medium mb-2">Documentation</div>
                  <a
                    href={selectedHook.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {selectedHook.documentation}
                  </a>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-sm font-medium text-blue-800 mb-1">Installation Notes</div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• Hook libraries are typically installed with Kea packages</div>
                  <div>• Check /usr/lib/x86_64-linux-gnu/kea/hooks/ for available libraries</div>
                  <div>• Some hooks require additional packages or database setup</div>
                  <div>• Configure hooks in the "hooks-libraries" section of Kea config</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hook Library Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Hook Library Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Command Hooks:</strong> Add new management commands to Kea Control Agent</div>
          <div>• <strong>Processing Hooks:</strong> Modify DHCP packet processing behavior</div>
          <div>• <strong>Backend Hooks:</strong> Add support for different databases and storage</div>
          <div>• <strong>Integration Hooks:</strong> Connect with external systems (RADIUS, logging)</div>
          <div>• <strong>Installation:</strong> Most hooks are included with Kea packages</div>
          <div>• <strong>Configuration:</strong> Enable hooks in the hooks-libraries configuration section</div>
        </div>
      </div>
    </div>
  )
}
