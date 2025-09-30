export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiError extends Error {
  status: number
  data?: any
}

export interface ApiConfig {
  baseUrl?: string
  authToken?: string
  csrfToken?: string
}

class ApiClient {
  private config: ApiConfig = {}

  constructor() {
    // Use relative URLs when MSW is enabled for better interception
    const useMSW = (import.meta as any).env?.VITE_USE_MSW === 'true' || (import.meta as any).env?.VITE_USE_MSW === '1'
    this.config.baseUrl = useMSW ? '/api' : ((import.meta as any).env?.VITE_API_BASE_URL || '/api')
  }

  setAuthToken(token: string | null) {
    this.config.authToken = token || undefined
  }

  setCsrfToken(token: string | null) {
    this.config.csrfToken = token || undefined
  }

  getCsrfToken(): string | undefined {
    return this.config.csrfToken
  }

  // Read CSRF token from cookie
  private getCsrfTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null

    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'csrf-token' || name === 'XSRF-TOKEN') {
        return decodeURIComponent(value)
      }
    }
    return null
  }

  getAuthToken(): string | undefined {
    return this.config.authToken
  }

  async request<T = any>(path: string, method: HttpMethod = 'GET', body?: any, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as any)
    }

    // Add auth token if available
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`
    }

    // Add CSRF token for mutating operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = this.config.csrfToken || this.getCsrfTokenFromCookie()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        ...init
      })

      const text = await res.text()
      const data = text ? JSON.parse(text) : null

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}: ${res.statusText}`) as ApiError
        error.status = res.status
        error.data = data
        throw error
      }

      return data as T
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error
        const networkError = new Error('Network error: Unable to connect to server') as ApiError
        networkError.status = 0
        throw networkError
      }
      throw error
    }
  }
}

// Global API client instance
export const apiClient = new ApiClient()

// Convenience function for backward compatibility
export async function api<T = any>(path: string, method: HttpMethod = 'GET', body?: any, init?: RequestInit): Promise<T> {
  return apiClient.request<T>(path, method, body, init)
}

