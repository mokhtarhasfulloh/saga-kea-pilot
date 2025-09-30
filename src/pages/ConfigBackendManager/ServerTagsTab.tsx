import { useState } from 'react'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface ServerTag {
  tag: string
  description: string
  servers: string[]
  created: string
}

export default function ServerTagsTab() {
  const [serverTags, setServerTags] = useState<ServerTag[]>([
    {
      tag: 'all',
      description: 'Default tag for all servers',
      servers: ['*'],
      created: '2024-01-01'
    },
    {
      tag: 'site-a',
      description: 'Servers at Site A location',
      servers: ['dhcp-a1', 'dhcp-a2'],
      created: '2024-01-15'
    },
    {
      tag: 'site-b',
      description: 'Servers at Site B location',
      servers: ['dhcp-b1'],
      created: '2024-01-20'
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<ServerTag | null>(null)
  
  // Form state
  const [tagName, setTagName] = useState('')
  const [description, setDescription] = useState('')
  const [servers, setServers] = useState('')
  const [saving, setSaving] = useState(false)

  function openForm(tag?: ServerTag) {
    setEditingTag(tag || null)
    setTagName(tag?.tag || '')
    setDescription(tag?.description || '')
    setServers(tag?.servers.join(', ') || '')
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function closeForm() {
    setShowForm(false)
    setEditingTag(null)
    setTagName('')
    setDescription('')
    setServers('')
    setError('')
    setSuccess('')
  }

  async function saveServerTag() {
    if (!tagName.trim()) {
      setError('Tag name is required')
      return
    }

    if (!description.trim()) {
      setError('Description is required')
      return
    }

    if (!servers.trim()) {
      setError('At least one server is required')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const serverList = servers.split(',').map(s => s.trim()).filter(Boolean)
      
      const newTag: ServerTag = {
        tag: tagName.trim(),
        description: description.trim(),
        servers: serverList,
        created: editingTag?.created || new Date().toISOString().split('T')[0]
      }

      if (editingTag) {
        setServerTags(prev => prev.map(t => t.tag === editingTag.tag ? newTag : t))
        setSuccess('Server tag updated successfully')
      } else {
        // Check if tag already exists
        if (serverTags.some(t => t.tag === tagName.trim())) {
          setError('Server tag already exists')
          setSaving(false)
          return
        }
        setServerTags(prev => [...prev, newTag])
        setSuccess('Server tag created successfully')
      }

      closeForm()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function deleteServerTag(tag: string) {
    if (tag === 'all') {
      setError('Cannot delete the default "all" tag')
      return
    }

    if (!confirm(`Delete server tag "${tag}"?`)) return

    setServerTags(prev => prev.filter(t => t.tag !== tag))
    setSuccess(`Server tag "${tag}" deleted successfully`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Server Tags Management</h2>
          <p className="text-sm text-gray-600">
            Manage server tags for configuration targeting in multi-server deployments
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={saving}>
          Add Server Tag
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Server Tags Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {serverTags.length}
            </div>
            <div className="text-sm text-gray-600">Total Tags</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {serverTags.reduce((sum, tag) => sum + tag.servers.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Tagged Servers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {serverTags.filter(t => t.tag !== 'all').length}
            </div>
            <div className="text-sm text-gray-600">Custom Tags</div>
          </CardContent>
        </Card>
      </div>

      {/* Server Tags Table */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Configured Server Tags</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Tag</Th>
                <Th>Description</Th>
                <Th>Servers</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {serverTags.map((tag, i) => (
                <Tr key={i}>
                  <Td>
                    <div className="font-medium font-mono">{tag.tag}</div>
                    {tag.tag === 'all' && (
                      <div className="text-xs text-blue-600">Default tag</div>
                    )}
                  </Td>
                  <Td className="text-sm text-gray-600">{tag.description}</Td>
                  <Td>
                    <div className="text-sm">
                      {tag.servers.length} server{tag.servers.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {tag.servers.slice(0, 3).join(', ')}
                      {tag.servers.length > 3 && '...'}
                    </div>
                  </Td>
                  <Td className="text-sm text-gray-600">{tag.created}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openForm(tag)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      {tag.tag !== 'all' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteServerTag(tag.tag)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Server Tag Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingTag ? 'Edit' : 'Create'} Server Tag
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tag Name *
                </label>
                <Input
                  value={tagName}
                  onChange={e => setTagName(e.target.value)}
                  placeholder="site-a"
                  disabled={saving || editingTag?.tag === 'all'}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Unique identifier for this server group (lowercase, no spaces)
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description *
                </label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Servers at Site A location"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Human-readable description of this server group
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Server Names *
                </label>
                <Input
                  value={servers}
                  onChange={e => setServers(e.target.value)}
                  placeholder="dhcp-server-1, dhcp-server-2"
                  disabled={saving}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Comma-separated list of server names or hostnames
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveServerTag} disabled={saving || !tagName.trim()}>
                {saving ? 'Saving...' : 'Save Tag'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Server Tags Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Server Tags Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Purpose:</strong> Group servers for targeted configuration deployment</div>
          <div>• <strong>Default Tag:</strong> "all" tag applies configuration to all servers</div>
          <div>• <strong>Custom Tags:</strong> Create tags for sites, roles, or environments</div>
          <div>• <strong>Usage:</strong> Use tags with remote-* commands to target specific servers</div>
          <div>• <strong>Examples:</strong> site-a, production, backup-servers, edge-nodes</div>
          <div>• <strong>Best Practice:</strong> Use descriptive names that reflect server grouping logic</div>
        </div>
      </div>
    </div>
  )
}
