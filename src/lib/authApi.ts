import { api, apiClient } from './api'
import { 
  LoginRequestT, 
  LoginResponseT, 
  UserProfileT, 
  PasswordChangeRequestT,
  SessionInfoT 
} from './schemas/auth'

/**
 * Authentication API client
 * Handles login, logout, session management, and user profile operations
 */
export const AuthApi = {
  // Login
  async login(credentials: LoginRequestT): Promise<LoginResponseT> {
    const response = await api<LoginResponseT>('/auth/login', 'POST', credentials)

    // Store auth token if login successful
    if (response.success && response.token) {
      apiClient.setAuthToken(response.token)
      this.setTokenInMemory(response.token)
    }

    return response
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await api('/auth/logout', 'POST')
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error)
    } finally {
      // Always clear local auth state
      apiClient.setAuthToken(null)
      this.clearTokenFromMemory()
    }
  },

  // Get current user profile
  async getProfile(): Promise<UserProfileT> {
    return await api<UserProfileT>('/auth/me', 'GET')
  },

  // Update user profile
  async updateProfile(profile: Partial<UserProfileT>): Promise<UserProfileT> {
    return await api<UserProfileT>('/auth/me', 'PUT', profile)
  },

  // Change password
  async changePassword(request: PasswordChangeRequestT): Promise<{ success: boolean; message?: string }> {
    return await api('/auth/change-password', 'POST', request)
  },

  // Refresh token
  async refreshToken(): Promise<LoginResponseT> {
    const response = await api<LoginResponseT>('/auth/refresh', 'POST')
    
    if (response.success && response.token) {
      apiClient.setAuthToken(response.token)
      this.setTokenInMemory(response.token)
    }
    
    return response
  },

  // Get session info
  async getSession(): Promise<SessionInfoT> {
    return await api<SessionInfoT>('/auth/session', 'GET')
  },

  // Validate current session
  async validateSession(): Promise<{ valid: boolean; user?: UserProfileT }> {
    try {
      const user = await this.getProfile()
      return { valid: true, user }
    } catch (error) {
      return { valid: false }
    }
  },

  // Get CSRF token
  async getCsrfToken(): Promise<string> {
    const response = await api<{ token: string }>('/auth/csrf', 'GET')
    apiClient.setCsrfToken(response.token)
    return response.token
  },

  // Token management (in-memory only for security)
  tokenStorage: null as string | null,

  setTokenInMemory(token: string | null) {
    this.tokenStorage = token
  },

  getTokenFromMemory(): string | null {
    return this.tokenStorage
  },

  clearTokenFromMemory() {
    this.tokenStorage = null
  },

  // Initialize auth state from existing token
  async initializeAuth(): Promise<{ isAuthenticated: boolean; user?: UserProfileT }> {
    try {
      const token = this.getTokenFromMemory()

      if (!token) {
        return { isAuthenticated: false }
      }

      // Set token in API client
      apiClient.setAuthToken(token)

      // Validate the token
      const validation = await this.validateSession()

      if (!validation.valid) {
        // Token is invalid, clear it
        this.clearTokenFromMemory()
        apiClient.setAuthToken(null)
        return { isAuthenticated: false }
      }

      return { isAuthenticated: true, user: validation.user }
    } catch (error) {
      // Clear any invalid state
      this.clearTokenFromMemory()
      apiClient.setAuthToken(null)
      return { isAuthenticated: false }
    }
  }
}
