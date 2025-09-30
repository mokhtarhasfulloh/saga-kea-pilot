import { api } from './api'
import { AuditLogListResponseT, AuditLogFiltersT, AuditLogT } from './schemas/audit'

/**
 * Audit logging API client
 * Provides methods for retrieving and filtering audit logs
 */
export const AuditApi = {
  // Get audit logs with optional filters
  async getLogs(filters: Partial<AuditLogFiltersT> = {}): Promise<AuditLogListResponseT> {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })

    return await api<AuditLogListResponseT>(`/audit/logs?${params}`, 'GET')
  },

  // Get recent audit logs (last 24 hours)
  async getRecentLogs(limit = 10): Promise<AuditLogListResponseT> {
    const endDate = new Date().toISOString()
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    return this.getLogs({
      startDate,
      endDate,
      limit,
      offset: 0
    })
  },

  // Get audit logs for a specific resource
  async getResourceLogs(resource: string, resourceId: string, limit = 20): Promise<AuditLogListResponseT> {
    return this.getLogs({
      resource: resource as any,
      resourceId,
      limit
    })
  },

  // Get audit logs for a specific user
  async getUserLogs(user: string, limit = 20): Promise<AuditLogListResponseT> {
    return this.getLogs({
      user,
      limit
    })
  },

  // Get a specific audit log entry
  async getLog(id: string): Promise<AuditLogT> {
    return await api<AuditLogT>(`/audit/logs/${id}`, 'GET')
  },

  // Create an audit log entry (typically done by the backend)
  async createLog(log: Omit<AuditLogT, 'id' | 'timestamp'>): Promise<AuditLogT> {
    return await api<AuditLogT>('/audit/logs', 'POST', log)
  },

  // Get audit statistics
  async getStatistics(days = 7): Promise<{
    totalLogs: number
    logsByAction: Record<string, number>
    logsByResource: Record<string, number>
    logsBySeverity: Record<string, number>
    logsByDay: Array<{ date: string; count: number }>
  }> {
    return await api(`/audit/statistics?days=${days}`, 'GET')
  }
}
