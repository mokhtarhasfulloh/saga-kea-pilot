import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Users, UserPlus, Edit, Trash2, Shield, Calendar, Mail } from 'lucide-react'
import { UserRoleT } from '../../lib/schemas/auth'

interface User {
  id: string
  username: string
  email?: string
  displayName?: string
  role: UserRoleT
  lastLogin?: string
  createdAt: string
  isActive: boolean
}

export default function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    displayName: '',
    role: 'viewer' as UserRoleT,
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      // TODO: Load users from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data
      const mockUsers: User[] = [
        {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          displayName: 'System Administrator',
          role: 'admin',
          lastLogin: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          isActive: true
        },
        {
          id: '2',
          username: 'operator1',
          email: 'operator@example.com',
          displayName: 'Network Operator',
          role: 'operator',
          lastLogin: new Date(Date.now() - 7200000).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          isActive: true
        },
        {
          id: '3',
          username: 'viewer1',
          email: 'viewer@example.com',
          displayName: 'Read Only User',
          role: 'viewer',
          lastLogin: new Date(Date.now() - 86400000).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          isActive: false
        }
      ]
      
      setUsers(mockUsers)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load users' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (userForm.password !== userForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (userForm.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' })
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // TODO: Create user via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'User created successfully' })
      setShowCreateForm(false)
      setUserForm({
        username: '',
        email: '',
        displayName: '',
        role: 'viewer',
        password: '',
        confirmPassword: ''
      })
      await loadUsers()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create user' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    setLoading(true)
    setMessage(null)
    try {
      // TODO: Update user via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'User updated successfully' })
      setEditingUser(null)
      await loadUsers()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update user' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      // TODO: Delete user via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'User deleted successfully' })
      await loadUsers()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete user' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Toggle user status via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ 
        type: 'success', 
        text: `User ${isActive ? 'activated' : 'deactivated'} successfully` 
      })
      await loadUsers()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update user status' })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: UserRoleT) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'operator': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} disabled={loading}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>
              Add a new user account to the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Username *</label>
                <Input
                  value={userForm.username}
                  onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={userForm.displayName}
                  onChange={(e) => setUserForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Enter display name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role *</label>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as UserRoleT }))}
                  className="mt-1"
                >
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Administrator</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Password *</label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm Password *</label>
                <Input
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateUser} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({users.length})
          </CardTitle>
          <CardDescription>
            Manage existing user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{user.displayName || user.username}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{user.username}
                      {user.email && (
                        <>
                          <span className="mx-2">•</span>
                          <Mail className="h-3 w-3 inline mr-1" />
                          {user.email}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                      {user.lastLogin && (
                        <>
                          <span className="mx-2">•</span>
                          Last login: {new Date(user.lastLogin).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleUserStatus(user.id, !user.isActive)}
                    disabled={loading}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(user)}
                    disabled={loading}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    disabled={loading || user.username === 'admin'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <Card>
          <CardHeader>
            <CardTitle>Edit User: {editingUser.username}</CardTitle>
            <CardDescription>
              Update user information and role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={editingUser.displayName || ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, displayName: e.target.value } : null)}
                  placeholder="Enter display name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  placeholder="Enter email address"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, role: e.target.value as UserRoleT } : null)}
                  className="mt-1"
                >
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Administrator</option>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateUser} disabled={loading}>
                {loading ? 'Updating...' : 'Update User'}
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
