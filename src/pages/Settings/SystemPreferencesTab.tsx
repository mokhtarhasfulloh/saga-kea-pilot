import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/select'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { themeAtom } from '../../state/theme'
import { Palette, Bell, Globe, Monitor, RefreshCw } from 'lucide-react'

export default function SystemPreferencesTab() {
  const [theme, setTheme] = useAtom(themeAtom)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    refreshInterval: '30',
    notifications: {
      systemAlerts: true,
      dhcpEvents: true,
      dnsEvents: true,
      securityAlerts: true,
      emailNotifications: false
    }
  })

  useEffect(() => {
    // Load saved preferences from localStorage or API
    const savedPrefs = localStorage.getItem('userPreferences')
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs)
        setPreferences(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('Failed to parse saved preferences:', error)
      }
    }
  }, [])

  const handleSavePreferences = async () => {
    setLoading(true)
    setMessage(null)
    try {
      // Save to localStorage (in a real app, this would be an API call)
      localStorage.setItem('userPreferences', JSON.stringify(preferences))
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMessage({ type: 'success', text: 'Preferences saved successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save preferences' })
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationChange = (key: keyof typeof preferences.notifications, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }))
  }

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ]

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of the interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Theme</label>
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="mt-1"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Choose your preferred color scheme
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>
            Configure language, timezone, and date/time formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Language</label>
              <Select
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="mt-1"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <Select
                value={preferences.timezone}
                onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                className="mt-1"
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date Format</label>
              <Select
                value={preferences.dateFormat}
                onChange={(e) => setPreferences(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="mt-1"
              >
                <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                <option value="dd MMM yyyy">dd MMM yyyy</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Time Format</label>
              <Select
                value={preferences.timeFormat}
                onChange={(e) => setPreferences(prev => ({ ...prev, timeFormat: e.target.value }))}
                className="mt-1"
              >
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            System Behavior
          </CardTitle>
          <CardDescription>
            Configure how the system behaves and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Auto-refresh Interval</label>
            <Select
              value={preferences.refreshInterval}
              onChange={(e) => setPreferences(prev => ({ ...prev, refreshInterval: e.target.value }))}
              className="mt-1"
            >
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
              <option value="0">Manual only</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              How often to automatically refresh data on dashboards
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose which events you want to be notified about
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {Object.entries(preferences.notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {key === 'systemAlerts' && 'Critical system alerts and errors'}
                    {key === 'dhcpEvents' && 'DHCP lease events and configuration changes'}
                    {key === 'dnsEvents' && 'DNS zone updates and query issues'}
                    {key === 'securityAlerts' && 'Security-related events and login attempts'}
                    {key === 'emailNotifications' && 'Send notifications via email'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleNotificationChange(key as any, e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSavePreferences} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  )
}
