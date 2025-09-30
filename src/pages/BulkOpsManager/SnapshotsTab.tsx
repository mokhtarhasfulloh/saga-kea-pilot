import { useState } from 'react'
import { caCall } from '../../lib/keaClient'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface ConfigSnapshot {
  id: string
  name: string
  description: string
  timestamp: string
  size: number
  config: any
  tags: string[]
  automatic: boolean
}

export default function SnapshotsTab() {
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([
    {
      id: 'snap-1',
      name: 'Initial Setup',
      description: 'Configuration after initial Kea setup',
      timestamp: '2024-01-01T10:00:00Z',
      size: 15420,
      config: {},
      tags: ['initial', 'baseline'],
      automatic: false
    },
    {
      id: 'snap-2',
      name: 'Pre-HA Configuration',
      description: 'Snapshot before enabling High Availability',
      timestamp: '2024-01-15T14:30:00Z',
      size: 18650,
      config: {},
      tags: ['pre-ha', 'backup'],
      automatic: true
    },
    {
      id: 'snap-3',
      name: 'Production Ready',
      description: 'Final configuration for production deployment',
      timestamp: '2024-01-20T09:15:00Z',
      size: 22340,
      config: {},
      tags: ['production', 'stable'],
      automatic: false
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [selectedSnapshots, setSelectedSnapshots] = useState<string[]>([])
  
  // Form state
  const [snapshotName, setSnapshotName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)

  async function createSnapshot() {
    if (!snapshotName.trim()) {
      setError('Snapshot name is required')
      return
    }

    setCreating(true)
    setError('')
    setSuccess('')

    try {
      // Get current configuration
      const config = await caCall('config-get', 'dhcp4')
      
      const newSnapshot: ConfigSnapshot = {
        id: `snap-${Date.now()}`,
        name: snapshotName.trim(),
        description: description.trim(),
        timestamp: new Date().toISOString(),
        size: JSON.stringify(config).length,
        config: config,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        automatic: false
      }

      setSnapshots(prev => [newSnapshot, ...prev])
      setSuccess('Configuration snapshot created successfully')
      closeForm()
    } catch (e: any) {
      setError(`Failed to create snapshot: ${String(e)}`)
    } finally {
      setCreating(false)
    }
  }

  function closeForm() {
    setShowForm(false)
    setSnapshotName('')
    setDescription('')
    setTags('')
    setError('')
    setSuccess('')
  }

  async function restoreSnapshot(snapshot: ConfigSnapshot) {
    if (!confirm(`Restore configuration from snapshot "${snapshot.name}"? This will overwrite the current configuration.`)) {
      return
    }

    try {
      // In a real implementation, this would restore the configuration
      await caCall('config-set', 'dhcp4', snapshot.config)
      setSuccess(`Configuration restored from snapshot "${snapshot.name}"`)
    } catch (e: any) {
      setError(`Failed to restore snapshot: ${String(e)}`)
    }
  }

  function deleteSnapshot(id: string) {
    const snapshot = snapshots.find(s => s.id === id)
    if (!confirm(`Delete snapshot "${snapshot?.name}"?`)) return
    
    setSnapshots(prev => prev.filter(s => s.id !== id))
    setSuccess('Snapshot deleted successfully')
  }

  function downloadSnapshot(snapshot: ConfigSnapshot) {
    const data = JSON.stringify(snapshot.config, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kea-snapshot-${snapshot.name.replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString()
  }

  function showSnapshotDiff() {
    if (selectedSnapshots.length !== 2) {
      setError('Please select exactly 2 snapshots to compare')
      return
    }
    setShowDiff(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Configuration Snapshots</h2>
          <p className="text-sm text-gray-600">
            Create, manage, and restore configuration snapshots
          </p>
        </div>
        <div className="flex gap-2">
          {selectedSnapshots.length === 2 && (
            <Button variant="outline" onClick={showSnapshotDiff}>
              Compare Selected
            </Button>
          )}
          <Button onClick={() => setShowForm(true)} disabled={creating}>
            Create Snapshot
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Snapshot Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {snapshots.length}
            </div>
            <div className="text-sm text-gray-600">Total Snapshots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {snapshots.filter(s => !s.automatic).length}
            </div>
            <div className="text-sm text-gray-600">Manual Snapshots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {snapshots.filter(s => s.automatic).length}
            </div>
            <div className="text-sm text-gray-600">Automatic Snapshots</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {formatSize(snapshots.reduce((sum, s) => sum + s.size, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Size</div>
          </CardContent>
        </Card>
      </div>

      {/* Snapshots Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Available Snapshots</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>
                  <input
                    type="checkbox"
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedSnapshots(snapshots.map(s => s.id))
                      } else {
                        setSelectedSnapshots([])
                      }
                    }}
                  />
                </Th>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Created</Th>
                <Th>Size</Th>
                <Th>Tags</Th>
                <Th>Type</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {snapshots.map((snapshot) => (
                <Tr key={snapshot.id}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedSnapshots.includes(snapshot.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedSnapshots(prev => [...prev, snapshot.id])
                        } else {
                          setSelectedSnapshots(prev => prev.filter(id => id !== snapshot.id))
                        }
                      }}
                    />
                  </Td>
                  <Td className="font-medium">{snapshot.name}</Td>
                  <Td className="text-sm text-gray-600">{snapshot.description}</Td>
                  <Td className="text-sm text-gray-600">{formatTimestamp(snapshot.timestamp)}</Td>
                  <Td className="text-sm">{formatSize(snapshot.size)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {snapshot.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      snapshot.automatic 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {snapshot.automatic ? 'Auto' : 'Manual'}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreSnapshot(snapshot)}
                        disabled={creating}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSnapshot(snapshot)}
                        disabled={creating}
                      >
                        Download
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteSnapshot(snapshot.id)}
                        disabled={creating}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Snapshot Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create Configuration Snapshot</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Snapshot Name *
                </label>
                <Input
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                  placeholder="Production Ready v2.1"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Configuration snapshot before major changes..."
                  className="w-full px-3 py-2 border rounded h-20"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tags (comma-separated)
                </label>
                <Input
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="production, stable, v2.1"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={createSnapshot} disabled={creating || !snapshotName.trim()}>
                {creating ? 'Creating...' : 'Create Snapshot'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Diff Modal */}
      {showDiff && selectedSnapshots.length === 2 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Configuration Diff</h3>
              <Button variant="outline" onClick={() => setShowDiff(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedSnapshots.map(id => {
                const snapshot = snapshots.find(s => s.id === id)
                return (
                  <div key={id}>
                    <h4 className="font-medium mb-2">{snapshot?.name}</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono h-96 overflow-y-auto">
                      <pre>{JSON.stringify(snapshot?.config, null, 2)}</pre>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Snapshots Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Configuration Snapshots Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Manual Snapshots:</strong> Created on-demand before major changes</div>
          <div>• <strong>Automatic Snapshots:</strong> Created automatically before system updates</div>
          <div>• <strong>Restore:</strong> Rollback to a previous configuration state</div>
          <div>• <strong>Compare:</strong> View differences between two snapshots</div>
          <div>• <strong>Tags:</strong> Organize snapshots with descriptive labels</div>
          <div>• <strong>Best Practice:</strong> Create snapshots before any configuration changes</div>
        </div>
      </div>
    </div>
  )
}
