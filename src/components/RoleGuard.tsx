import { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UserRoleT } from '../lib/schemas/auth'

interface RoleGuardProps {
  children: ReactNode
  requiredRole?: UserRoleT
  requiredPermission?: string
  fallback?: ReactNode
  hideIfNoAccess?: boolean
}

/**
 * Component that conditionally renders children based on user role/permissions
 */
export function RoleGuard({ 
  children, 
  requiredRole, 
  requiredPermission, 
  fallback,
  hideIfNoAccess = false
}: RoleGuardProps) {
  const { user, hasRole, hasPermission } = useAuth()

  if (!user) {
    return hideIfNoAccess ? null : (fallback || <div className="text-gray-500">Not authenticated</div>)
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return hideIfNoAccess ? null : (fallback || <div className="text-gray-500">Insufficient role</div>)
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return hideIfNoAccess ? null : (fallback || <div className="text-gray-500">Access denied</div>)
  }

  return <>{children}</>
}

interface ConditionalButtonProps {
  children: ReactNode
  requiredPermission?: string
  requiredRole?: UserRoleT
  className?: string
  onClick?: () => void
  disabled?: boolean
  [key: string]: any
}

/**
 * Button component that automatically disables based on permissions
 */
export function ConditionalButton({ 
  children, 
  requiredPermission, 
  requiredRole, 
  disabled = false,
  ...props 
}: ConditionalButtonProps) {
  const { hasRole, hasPermission } = useAuth()

  const hasAccess = (!requiredRole || hasRole(requiredRole)) && 
                   (!requiredPermission || hasPermission(requiredPermission))

  return (
    <button 
      {...props}
      disabled={disabled || !hasAccess}
      className={`${props.className || ''} ${!hasAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={!hasAccess ? 'You do not have permission to perform this action' : props.title}
    >
      {children}
    </button>
  )
}

interface RoleBasedContentProps {
  admin?: ReactNode
  operator?: ReactNode
  viewer?: ReactNode
  fallback?: ReactNode
}

/**
 * Component that renders different content based on user role
 */
export function RoleBasedContent({ admin, operator, viewer, fallback }: RoleBasedContentProps) {
  const { user } = useAuth()

  if (!user) {
    return <>{fallback}</>
  }

  switch (user.role) {
    case 'admin':
      return <>{admin || fallback}</>
    case 'operator':
      return <>{operator || fallback}</>
    case 'viewer':
      return <>{viewer || fallback}</>
    default:
      return <>{fallback}</>
  }
}

interface PermissionWrapperProps {
  children: ReactNode
  permission: string
  fallback?: ReactNode
  showFallback?: boolean
}

/**
 * Wrapper that shows/hides content based on specific permissions
 */
export function PermissionWrapper({ 
  children, 
  permission, 
  fallback, 
  showFallback = false 
}: PermissionWrapperProps) {
  const { hasPermission } = useAuth()

  if (hasPermission(permission)) {
    return <>{children}</>
  }

  if (showFallback && fallback) {
    return <>{fallback}</>
  }

  return null
}
