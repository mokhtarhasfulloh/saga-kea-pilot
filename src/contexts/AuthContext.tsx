import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthApi } from '../lib/authApi'
import { UserProfileT, LoginRequestT, UserRoleT, hasPermission } from '../lib/schemas/auth'

interface AuthContextType {
  isAuthenticated: boolean
  user: UserProfileT | null
  loading: boolean
  login: (credentials: LoginRequestT) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: UserRoleT) => boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserProfileT | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize authentication state
  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    setLoading(true)
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
      )

      const result = await Promise.race([
        AuthApi.initializeAuth(),
        timeoutPromise
      ]) as { isAuthenticated: boolean; user?: any }

      setIsAuthenticated(result.isAuthenticated)
      setUser(result.user || null)
    } catch (error) {
      // On error, assume not authenticated and continue
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (credentials: LoginRequestT): Promise<{ success: boolean; message?: string }> => {
    setLoading(true)
    try {
      const response = await AuthApi.login(credentials)

      if (response.success && response.user) {
        setIsAuthenticated(true)
        setUser(response.user)
        return { success: true }
      } else {
        return { success: false, message: response.message || 'Login failed' }
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Login failed. Please check your credentials.'
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await AuthApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (!isAuthenticated) return

    try {
      const profile = await AuthApi.getProfile()
      setUser(profile)

      // Apply user theme preference if available
      if (profile.preferences?.theme) {
        const theme = profile.preferences.theme
        if (theme === 'dark' || theme === 'light') {
          localStorage.setItem('theme', theme)
          const cl = document.documentElement.classList
          if (theme === 'dark') {
            cl.add('dark')
          } else {
            cl.remove('dark')
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error)
      // If profile fetch fails, user might be logged out
      await logout()
    }
  }

  const checkPermission = (permission: string): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission as any)
  }

  const checkRole = (role: UserRoleT): boolean => {
    if (!user) return false
    return user.role === role
  }

  const value: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    hasPermission: checkPermission,
    hasRole: checkRole,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protecting routes
interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRoleT
  requiredPermission?: string
  fallback?: ReactNode
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredPermission, 
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, hasPermission, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback || <LoginRequired />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || <AccessDenied />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || <AccessDenied />
  }

  return <>{children}</>
}

function LoginRequired() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to access this page.</p>
      </div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access this page.</p>
      </div>
    </div>
  )
}
