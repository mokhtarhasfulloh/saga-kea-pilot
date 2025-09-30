import { z } from 'zod'

// User roles
export const UserRole = z.enum(['admin', 'operator', 'viewer'])

// Login request
export const LoginRequest = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

// Login response
export const LoginResponse = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: UserRole,
    email: z.string().optional(),
    displayName: z.string().optional()
  }).optional(),
  message: z.string().optional(),
  expiresAt: z.string().optional()
})

// User profile
export const UserProfile = z.object({
  id: z.string(),
  username: z.string(),
  role: UserRole,
  email: z.string().optional(),
  displayName: z.string().optional(),
  lastLogin: z.string().optional(),
  createdAt: z.string().optional(),
  preferences: z.record(z.string(), z.any()).optional()
})

// Auth context
export const AuthContext = z.object({
  isAuthenticated: z.boolean(),
  user: UserProfile.optional(),
  token: z.string().optional(),
  loading: z.boolean().default(false)
})

// Password change request
export const PasswordChangeRequest = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

// Session info
export const SessionInfo = z.object({
  id: z.string(),
  user: UserProfile,
  createdAt: z.string(),
  lastActivity: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  expiresAt: z.string()
})

// Type exports
export type UserRoleT = z.infer<typeof UserRole>
export type LoginRequestT = z.infer<typeof LoginRequest>
export type LoginResponseT = z.infer<typeof LoginResponse>
export type UserProfileT = z.infer<typeof UserProfile>
export type AuthContextT = z.infer<typeof AuthContext>
export type PasswordChangeRequestT = z.infer<typeof PasswordChangeRequest>
export type SessionInfoT = z.infer<typeof SessionInfo>

// Role permissions
export const ROLE_PERMISSIONS = {
  admin: {
    canRead: true,
    canWrite: true,
    canDelete: true,
    canManageUsers: true,
    canManageConfig: true,
    canViewAuditLogs: true
  },
  operator: {
    canRead: true,
    canWrite: true,
    canDelete: false,
    canManageUsers: false,
    canManageConfig: false,
    canViewAuditLogs: true
  },
  viewer: {
    canRead: true,
    canWrite: false,
    canDelete: false,
    canManageUsers: false,
    canManageConfig: false,
    canViewAuditLogs: false
  }
} as const

export function hasPermission(role: UserRoleT, permission: keyof typeof ROLE_PERMISSIONS.admin): boolean {
  return ROLE_PERMISSIONS[role][permission] || false
}
