import { useEffect, useState } from 'react'
import { AuditApi } from '../lib/auditApi'
import { AuditLogT, AuditSeverityT } from '../lib/schemas/audit'
import { Card } from './ui/card'
import { Button } from './ui/button'

interface RecentAuditLogsProps {
  limit?: number
  showHeader?: boolean
}

export default function RecentAuditLogs({ limit = 10, showHeader = true }: RecentAuditLogsProps) {
  const [logs, setLogs] = useState<AuditLogT[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const loadLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await AuditApi.getRecentLogs(limit)
      setLogs(response.logs)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [limit])

  const getSeverityColor = (severity: AuditSeverityT) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50'
      case 'info':
      default:
        return 'text-blue-600 bg-blue-50'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return '+'
      case 'update':
        return '✎'
      case 'delete':
        return '×'
      case 'view':
        return '👁'
      case 'login':
        return '🔑'
      case 'logout':
        return '🚪'
      case 'config_change':
        return '⚙'
      case 'zone_reload':
        return '🔄'
      case 'zone_validate':
        return '✓'
      default:
        return '•'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getResourceLink = (log: AuditLogT) => {
    // Generate links to affected resources
    if (log.resource === 'zone' && log.resourceId) {
      return `/dns?zone=${log.resourceId}`
    }
    if (log.resource === 'subnet' && log.resourceId) {
      return `/dhcp?subnet=${log.resourceId}`
    }
    if (log.resource === 'reservation' && log.resourceId) {
      return `/dhcp?reservation=${log.resourceId}`
    }
    return null
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-600">Loading audit logs...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-red-600 mb-2">Error: {error}</div>
        <Button onClick={loadLogs} variant="outline" size="sm">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <Button onClick={loadLogs} variant="ghost" size="sm">
            Refresh
          </Button>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center text-gray-600 py-8">
          <div className="text-lg mb-2">No recent activity</div>
          <div className="text-sm">Audit logs will appear here as actions are performed</div>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const resourceLink = getResourceLink(log)
            
            return (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                  {getActionIcon(log.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{log.message}</span>
                    {!log.success && (
                      <span className="px-1 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        Failed
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatTimestamp(log.timestamp)}</span>
                    {log.user && <span>by {log.user}</span>}
                    {log.resourceName && (
                      <span>
                        {resourceLink ? (
                          <a href={resourceLink} className="text-blue-600 hover:underline">
                            {log.resourceName}
                          </a>
                        ) : (
                          log.resourceName
                        )}
                      </span>
                    )}
                  </div>
                  
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {Object.entries(log.details).slice(0, 2).map(([key, value]) => (
                        <div key={key} className="inline-block mr-4">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
