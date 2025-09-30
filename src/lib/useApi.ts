import { useCallback, useState } from 'react'
import { api, apiClient, ApiError, HttpMethod } from './api'

export interface UseApiResult {
  loading: boolean
  error: string
  request: <T>(path: string, method?: HttpMethod, body?: any) => Promise<T>
  setAuthToken: (token: string | null) => void
  getAuthToken: () => string | undefined
  clearError: () => void
}

export function useApi(): UseApiResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const request = useCallback(async function <T>(path: string, method: HttpMethod = 'GET', body?: any): Promise<T> {
    setLoading(true)
    setError('')
    try {
      const data = await api<T>(path, method, body)
      return data
    } catch (e: any) {
      const apiError = e as ApiError
      let errorMessage = 'An unexpected error occurred'

      if (apiError.status === 0) {
        errorMessage = 'Network error: Unable to connect to server'
      } else if (apiError.status === 401) {
        errorMessage = 'Authentication required. Please log in.'
      } else if (apiError.status === 403) {
        errorMessage = 'Access denied. You do not have permission to perform this action.'
      } else if (apiError.status === 404) {
        errorMessage = 'Resource not found'
      } else if (apiError.status === 429) {
        errorMessage = 'Too many requests. Please try again later.'
      } else if (apiError.status >= 500) {
        errorMessage = 'Server error. Please try again later.'
      } else if (apiError.message) {
        errorMessage = apiError.message
      }

      setError(errorMessage)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const setAuthToken = useCallback((token: string | null) => {
    apiClient.setAuthToken(token)
  }, [])

  const getAuthToken = useCallback(() => {
    return apiClient.getAuthToken()
  }, [])

  const clearError = useCallback(() => {
    setError('')
  }, [])

  return {
    loading,
    error,
    request,
    setAuthToken,
    getAuthToken,
    clearError
  }
}

