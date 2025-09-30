import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
// import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Shield, Lock, Clock, Eye, RefreshCw } from 'lucide-react'

interface Session {
  id: string
  username: string
  ipAddress: string
  userAgent: string
  createdAt: string
  lastActivity: string
  isCurrent: boolean
}

export default function SecurityTab() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: '3600',
    maxSessions: '5',
    passwordPolicy: {
      minLength: '8',
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      passwordExpiry: '90'
    },
    loginSecurity: {
      maxFailedAttempts: '5',
      lockoutDuration: '300',
      enableTwoFactor: false,
      requireStrongPasswords: true
    },
    auditSettings: {
      logFailedLogins: true,
      logSuccessfulLogins: true,
      logConfigChanges: true,
      logDataAccess: false,
      retentionDays: '365'
    }
  })

  useEffect(() => {
    loadSecuritySettings()
    loadActiveSessions()
  }, [])

  const loadSecuritySettings = async () => {
    setLoading(true)
    try {
      // TODO: Load security settings from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Settings would be loaded here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load security settings' })
    } finally {
      setLoading(false)
    }
  }

  const loadActiveSessions = async () => {
    try {
      // TODO: Load active sessions from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data
      const mockSessions: Session[] = [
        {
          id: '1',
          username: 'admin',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          lastActivity: new Date(Date.now() - 300000).toISOString(),
          isCurrent: true
        },
        {
          id: '2',
          username: 'admin',
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          lastActivity: new Date(Date.now() - 1800000).toISOString(),
          isCurrent: false
        }
      ]
      
      setSessions(mockSessions)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load active sessions' })
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // TODO: Save security settings via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'Security settings saved successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save security settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) {
      return
    }

    setLoading(true)
    try {
      // TODO: Terminate session via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'Session terminated successfully' })
      await loadActiveSessions()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to terminate session' })
    } finally {
      setLoading(false)
    }
  }

  const handleTerminateAllSessions = async () => {
    if (!confirm('Are you sure you want to terminate all other sessions? This will log out all other users.')) {
      return
    }

    setLoading(true)
    try {
      // TODO: Terminate all sessions via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'All other sessions terminated successfully' })
      await loadActiveSessions()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to terminate sessions' })
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

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Session Management
          </CardTitle>
          <CardDescription>
            Configure session timeouts and view active sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Session Timeout (seconds)</label>
              <Input
                type="number"
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How long before inactive sessions expire
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Max Concurrent Sessions</label>
              <Input
                type="number"
                value={securitySettings.maxSessions}
                onChange={(e) => setSecuritySettings(prev => ({ ...prev, maxSessions: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum sessions per user
              </p>
            </div>
          </div>

          <div className="pt-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Active Sessions ({sessions.length})</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadActiveSessions}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleTerminateAllSessions} disabled={loading}>
                  Terminate All Others
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{session.username}</span>
                      {session.isCurrent && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.ipAddress} • {session.userAgent.substring(0, 50)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(session.createdAt).toLocaleString()} • 
                      Last activity: {new Date(session.lastActivity).toLocaleString()}
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTerminateSession(session.id)}
                      disabled={loading}
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password Policy
          </CardTitle>
          <CardDescription>
            Configure password requirements and security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Minimum Length</label>
              <Input
                type="number"
                value={securitySettings.passwordPolicy.minLength}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, minLength: e.target.value }
                }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password Expiry (days)</label>
              <Input
                type="number"
                value={securitySettings.passwordPolicy.passwordExpiry}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, passwordExpiry: e.target.value }
                }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Password Requirements</h4>
            {Object.entries({
              requireUppercase: 'Require uppercase letters',
              requireLowercase: 'Require lowercase letters',
              requireNumbers: 'Require numbers',
              requireSpecialChars: 'Require special characters'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="checkbox"
                  checked={securitySettings.passwordPolicy[key as keyof typeof securitySettings.passwordPolicy] as boolean}
                  onChange={(e) => setSecuritySettings(prev => ({
                    ...prev,
                    passwordPolicy: {
                      ...prev.passwordPolicy,
                      [key]: e.target.checked
                    }
                  }))}
                  className="h-4 w-4"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Login Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Login Security
          </CardTitle>
          <CardDescription>
            Configure login attempt limits and security measures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Max Failed Attempts</label>
              <Input
                type="number"
                value={securitySettings.loginSecurity.maxFailedAttempts}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  loginSecurity: { ...prev.loginSecurity, maxFailedAttempts: e.target.value }
                }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Lockout Duration (seconds)</label>
              <Input
                type="number"
                value={securitySettings.loginSecurity.lockoutDuration}
                onChange={(e) => setSecuritySettings(prev => ({
                  ...prev,
                  loginSecurity: { ...prev.loginSecurity, lockoutDuration: e.target.value }
                }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries({
              enableTwoFactor: 'Enable Two-Factor Authentication',
              requireStrongPasswords: 'Require Strong Passwords'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="checkbox"
                  checked={securitySettings.loginSecurity[key as keyof typeof securitySettings.loginSecurity] as boolean}
                  onChange={(e) => setSecuritySettings(prev => ({
                    ...prev,
                    loginSecurity: {
                      ...prev.loginSecurity,
                      [key]: e.target.checked
                    }
                  }))}
                  className="h-4 w-4"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Audit & Logging
          </CardTitle>
          <CardDescription>
            Configure what activities to log and audit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Log Retention (days)</label>
            <Input
              type="number"
              value={securitySettings.auditSettings.retentionDays}
              onChange={(e) => setSecuritySettings(prev => ({
                ...prev,
                auditSettings: { ...prev.auditSettings, retentionDays: e.target.value }
              }))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How long to keep audit logs
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Audit Events</h4>
            {Object.entries({
              logFailedLogins: 'Log Failed Login Attempts',
              logSuccessfulLogins: 'Log Successful Logins',
              logConfigChanges: 'Log Configuration Changes',
              logDataAccess: 'Log Data Access Events'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="checkbox"
                  checked={securitySettings.auditSettings[key as keyof typeof securitySettings.auditSettings] as boolean}
                  onChange={(e) => setSecuritySettings(prev => ({
                    ...prev,
                    auditSettings: {
                      ...prev.auditSettings,
                      [key]: e.target.checked
                    }
                  }))}
                  className="h-4 w-4"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Security Settings'
          )}
        </Button>
      </div>
    </div>
  )
}
