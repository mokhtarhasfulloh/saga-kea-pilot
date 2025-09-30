/**
 * Role-Based Access Control (RBAC) Middleware for SagaOS DNS Operations
 * Provides fine-grained access control for DNS management endpoints
 */

// DNS Role Definitions
const DNS_ROLES = {
  DNS_VIEWER: 'dns_viewer',
  DNS_OPERATOR: 'dns_operator', 
  DNS_ADMIN: 'dns_admin',
  ADMIN: 'admin'
}

// DNS Permission Definitions
const DNS_PERMISSIONS = {
  // Read permissions
  VIEW_ZONES: 'dns:zones:read',
  VIEW_RECORDS: 'dns:records:read',
  VIEW_STATUS: 'dns:status:read',
  VIEW_AUDIT: 'dns:audit:read',
  
  // Write permissions
  CREATE_RECORDS: 'dns:records:create',
  UPDATE_RECORDS: 'dns:records:update',
  DELETE_RECORDS: 'dns:records:delete',
  
  // Zone management permissions
  CREATE_ZONES: 'dns:zones:create',
  UPDATE_ZONES: 'dns:zones:update',
  DELETE_ZONES: 'dns:zones:delete',
  VALIDATE_ZONES: 'dns:zones:validate',
  RELOAD_ZONES: 'dns:zones:reload',
  
  // Administrative permissions
  MANAGE_DDNS: 'dns:ddns:manage',
  VIEW_LOGS: 'dns:logs:read',
  MANAGE_CONFIG: 'dns:config:manage'
}

// Flattened role permissions
const FLATTENED_PERMISSIONS = {
  'dns_viewer': [
    DNS_PERMISSIONS.VIEW_ZONES,
    DNS_PERMISSIONS.VIEW_RECORDS,
    DNS_PERMISSIONS.VIEW_STATUS
  ],
  'dns_operator': [
    DNS_PERMISSIONS.VIEW_ZONES,
    DNS_PERMISSIONS.VIEW_RECORDS,
    DNS_PERMISSIONS.VIEW_STATUS,
    DNS_PERMISSIONS.CREATE_RECORDS,
    DNS_PERMISSIONS.UPDATE_RECORDS,
    DNS_PERMISSIONS.DELETE_RECORDS,
    DNS_PERMISSIONS.VALIDATE_ZONES,
    DNS_PERMISSIONS.RELOAD_ZONES
  ],
  'dns_admin': [
    DNS_PERMISSIONS.VIEW_ZONES,
    DNS_PERMISSIONS.VIEW_RECORDS,
    DNS_PERMISSIONS.VIEW_STATUS,
    DNS_PERMISSIONS.CREATE_RECORDS,
    DNS_PERMISSIONS.UPDATE_RECORDS,
    DNS_PERMISSIONS.DELETE_RECORDS,
    DNS_PERMISSIONS.VALIDATE_ZONES,
    DNS_PERMISSIONS.RELOAD_ZONES,
    DNS_PERMISSIONS.CREATE_ZONES,
    DNS_PERMISSIONS.UPDATE_ZONES,
    DNS_PERMISSIONS.DELETE_ZONES,
    DNS_PERMISSIONS.MANAGE_DDNS,
    DNS_PERMISSIONS.VIEW_LOGS,
    DNS_PERMISSIONS.VIEW_AUDIT
  ],
  'admin': Object.values(DNS_PERMISSIONS)
}

/**
 * Extract user information from request
 * For demo purposes, we'll use a mock admin user
 */
function extractUser(req) {
  // For development, use mock admin user
  // In production, this would decode and validate JWT
  return {
    id: '1',
    username: 'admin',
    email: 'admin@sagaos.com',
    role: 'admin', // Full access for demo
    tenantId: '00000000-0000-0000-0000-000000000000'
  }
}

/**
 * Check if user has required permission
 */
function hasPermission(user, requiredPermission) {
  if (!user || !user.role) {
    return false
  }
  
  // Admin role has all permissions
  if (user.role === 'admin') {
    return true
  }
  
  // Check role-based permissions
  const userPermissions = FLATTENED_PERMISSIONS[user.role] || []
  return userPermissions.includes(requiredPermission)
}

/**
 * RBAC Middleware Factory
 * Creates middleware that checks for specific DNS permissions
 */
function requireDnsPermission(permission) {
  return (req, res, next) => {
    try {
      const user = extractUser(req)
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }
      
      if (!hasPermission(user, permission)) {
        return res.status(403).json({
          error: 'Insufficient permissions for DNS operation',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: permission,
          userRole: user.role
        })
      }
      
      // Add user to request for audit logging
      req.user = user
      next()
    } catch (error) {
      console.error('RBAC middleware error:', error)
      res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTH_ERROR'
      })
    }
  }
}

/**
 * Audit logging middleware
 * Logs DNS operations for security and compliance
 */
function auditDnsOperation(action) {
  return (req, res, next) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log the operation after response
      setImmediate(() => {
        try {
          const user = req.user
          const success = res.statusCode < 400
          
          if (user) {
            console.log('DNS Audit Log:', {
              tenantId: user.tenantId,
              userId: user.id,
              action,
              zoneName: req.params.zone,
              recordName: req.params.name,
              recordType: req.params.type,
              success,
              statusCode: res.statusCode,
              timestamp: new Date().toISOString(),
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            })
          }
        } catch (error) {
          console.error('Audit logging error:', error)
        }
      })
      
      originalSend.call(this, data)
    }
    
    next()
  }
}

/**
 * Rate limiting for DNS operations
 */
const rateLimitStore = new Map()

function rateLimitDns(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const user = req.user || extractUser(req)
    if (!user) {
      return next() // Auth middleware will handle this
    }
    
    const key = `${user.id}:${req.route?.path || req.path}`
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Clean old entries
    const userRequests = rateLimitStore.get(key) || []
    const validRequests = userRequests.filter(time => time > windowStart)
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded for DNS operations',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }
    
    validRequests.push(now)
    rateLimitStore.set(key, validRequests)
    
    next()
  }
}

module.exports = {
  DNS_ROLES,
  DNS_PERMISSIONS,
  requireDnsPermission,
  auditDnsOperation,
  rateLimitDns,
  hasPermission,
  extractUser
}
