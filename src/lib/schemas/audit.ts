import { z } from 'zod'

// Audit log entry types
export const AuditAction = z.enum([
  'create',
  'update', 
  'delete',
  'view',
  'login',
  'logout',
  'config_change',
  'zone_reload',
  'zone_validate',
  'lease_assign',
  'lease_release',
  'subnet_add',
  'subnet_update',
  'reservation_add',
  'reservation_update'
])

export const AuditResource = z.enum([
  'user',
  'zone',
  'record',
  'subnet',
  'reservation',
  'lease',
  'config',
  'system'
])

export const AuditSeverity = z.enum([
  'info',
  'warning',
  'error',
  'critical'
])

// Audit log entry
export const AuditLog = z.object({
  id: z.string(),
  timestamp: z.string(),
  user: z.string().optional(),
  action: AuditAction,
  resource: AuditResource,
  resourceId: z.string().optional(),
  resourceName: z.string().optional(),
  severity: AuditSeverity.default('info'),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  success: z.boolean().default(true)
})

// Audit log list response
export const AuditLogListResponse = z.object({
  logs: z.array(AuditLog),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional()
})

// Audit log filters
export const AuditLogFilters = z.object({
  user: z.string().optional(),
  action: AuditAction.optional(),
  resource: AuditResource.optional(),
  resourceId: z.string().optional(),
  severity: AuditSeverity.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
})

// Type exports
export type AuditLogT = z.infer<typeof AuditLog>
export type AuditActionT = z.infer<typeof AuditAction>
export type AuditResourceT = z.infer<typeof AuditResource>
export type AuditSeverityT = z.infer<typeof AuditSeverity>
export type AuditLogListResponseT = z.infer<typeof AuditLogListResponse>
export type AuditLogFiltersT = z.infer<typeof AuditLogFilters>
