import { useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface RemoteCommand {
  command: string
  description: string
  parameters: string[]
  example: string
}

const REMOTE_COMMANDS: RemoteCommand[] = [
  {
    command: 'remote-subnet4-list',
    description: 'List all IPv4 subnets from config backend',
    parameters: ['server-tags (optional)'],
    example: 'remote-subnet4-list'
  },
  {
    command: 'remote-subnet4-get',
    description: 'Get specific IPv4 subnet configuration',
    parameters: ['subnet-id', 'server-tags (optional)'],
    example: 'remote-subnet4-get {"subnet-id": 1}'
  },
  {
    command: 'remote-subnet4-set',
    description: 'Create or update IPv4 subnet in config backend',
    parameters: ['subnet4', 'server-tags (optional)'],
    example: 'remote-subnet4-set {"subnet4": {...}}'
  },
  {
    command: 'remote-subnet4-del',
    description: 'Delete IPv4 subnet from config backend',
    parameters: ['subnet-id', 'server-tags (optional)'],
    example: 'remote-subnet4-del {"subnet-id": 1}'
  },
  {
    command: 'remote-network4-list',
    description: 'List all shared networks from config backend',
    parameters: ['server-tags (optional)'],
    example: 'remote-network4-list'
  },
  {
    command: 'remote-option-def4-list',
    description: 'List all option definitions from config backend',
    parameters: ['server-tags (optional)'],
    example: 'remote-option-def4-list'
  }
]

export default function RemoteConfigTab() {
  const [commandResults, setCommandResults] = useState<Array<{
    command: string
    timestamp: string
    result: any
    success: boolean
  }>>([])
  const [selectedCommand, setSelectedCommand] = useState('')
  const [commandParams, setCommandParams] = useState('')
  const [serverTags, setServerTags] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [executing, setExecuting] = useState(false)

  async function executeRemoteCommand() {
    if (!selectedCommand) {
      setError('Please select a command')
      return
    }

    setExecuting(true)
    setError('')
    setSuccess('')

    try {
      let params: any = {}
      
      // Parse command parameters
      if (commandParams.trim()) {
        try {
          params = JSON.parse(commandParams)
        } catch {
          setError('Invalid JSON in command parameters')
          setExecuting(false)
          return
        }
      }

      // Add server tags if specified
      if (serverTags.trim()) {
        params['server-tags'] = serverTags.split(',').map(tag => tag.trim()).filter(Boolean)
      }

      const result = await caCall(selectedCommand, 'dhcp4', params)
      
      setCommandResults(prev => [{
        command: selectedCommand,
        timestamp: new Date().toLocaleString(),
        result: result,
        success: result.result === 0
      }, ...prev.slice(0, 9)]) // Keep last 10 results

      if (result.result === 0) {
        setSuccess(`Command "${selectedCommand}" executed successfully`)
      } else {
        setError(`Command failed: ${result.text || 'Unknown error'}`)
      }
    } catch (e: any) {
      setError(`Failed to execute command: ${String(e)}`)
      setCommandResults(prev => [{
        command: selectedCommand,
        timestamp: new Date().toLocaleString(),
        result: { error: String(e) },
        success: false
      }, ...prev.slice(0, 9)])
    } finally {
      setExecuting(false)
    }
  }

  function clearResults() {
    setCommandResults([])
    setSuccess('Command history cleared')
  }

  function loadCommandExample(command: RemoteCommand) {
    setSelectedCommand(command.command)
    
    // Set example parameters
    if (command.example.includes('{')) {
      const match = command.example.match(/\{.*\}/)
      if (match) {
        setCommandParams(match[0])
      }
    } else {
      setCommandParams('')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Remote Configuration Commands</h2>
        <p className="text-sm text-gray-600">
          Execute remote configuration commands against the config backend
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Command Execution */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Execute Remote Command</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Command *
            </label>
            <select
              value={selectedCommand}
              onChange={e => setSelectedCommand(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              disabled={executing}
            >
              <option value="">Select a command...</option>
              {REMOTE_COMMANDS.map(cmd => (
                <option key={cmd.command} value={cmd.command}>
                  {cmd.command} - {cmd.description}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Parameters (JSON)
              </label>
              <textarea
                value={commandParams}
                onChange={e => setCommandParams(e.target.value)}
                placeholder='{"subnet-id": 1}'
                className="w-full px-3 py-2 border rounded h-24 font-mono text-sm"
                disabled={executing}
              />
              <div className="text-xs text-gray-500 mt-1">
                Command-specific parameters in JSON format
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Server Tags (optional)
              </label>
              <Input
                value={serverTags}
                onChange={e => setServerTags(e.target.value)}
                placeholder="all, site-a, production"
                disabled={executing}
              />
              <div className="text-xs text-gray-500 mt-1">
                Comma-separated list of server tags to target
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={executeRemoteCommand} disabled={executing || !selectedCommand}>
              {executing ? 'Executing...' : 'Execute Command'}
            </Button>
            {commandResults.length > 0 && (
              <Button variant="outline" onClick={clearResults} disabled={executing}>
                Clear History
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Commands Reference */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Available Remote Commands</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Command</Th>
                <Th>Description</Th>
                <Th>Parameters</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {REMOTE_COMMANDS.map((cmd, i) => (
                <Tr key={i}>
                  <Td className="font-mono text-sm">{cmd.command}</Td>
                  <Td className="text-sm">{cmd.description}</Td>
                  <Td className="text-xs text-gray-600">
                    {cmd.parameters.join(', ')}
                  </Td>
                  <Td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadCommandExample(cmd)}
                      disabled={executing}
                    >
                      Load Example
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Command Results */}
      {commandResults.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Command Results</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commandResults.map((result, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-sm">{result.command}</div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.success ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify(result.result, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remote Commands Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Remote Commands Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Config Backend Required:</strong> These commands require an active config backend</div>
          <div>• <strong>Server Tags:</strong> Target specific servers or use "all" for global changes</div>
          <div>• <strong>JSON Parameters:</strong> Most commands require JSON-formatted parameters</div>
          <div>• <strong>Validation:</strong> Commands validate configuration before applying changes</div>
          <div>• <strong>Persistence:</strong> Changes are stored in the database backend</div>
          <div>• <strong>Synchronization:</strong> Changes are automatically distributed to tagged servers</div>
        </div>
      </div>
    </div>
  )
}
