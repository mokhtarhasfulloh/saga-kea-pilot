import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, api } from '../api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    apiClient.setAuthToken(null)
    apiClient.setCsrfToken(null)
  })

  describe('GET requests', () => {
    it('makes successful GET request', async () => {
      const mockResponse = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      })

      const result = await apiClient.request('/test', 'GET')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          credentials: 'include'
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('handles GET request errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(JSON.stringify({ error: 'Resource not found' }))
      })

      await expect(apiClient.request('/nonexistent', 'GET')).rejects.toThrow('HTTP 404: Not Found')
    })
  })

  describe('POST requests', () => {
    it('makes successful POST request with data', async () => {
      const requestData = { name: 'test', value: 123 }
      const mockResponse = { id: 1, ...requestData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      })

      const result = await apiClient.request('/create', 'POST', requestData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/create'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(requestData),
          credentials: 'include'
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Authentication', () => {
    it('includes authorization header when token is set', async () => {
      apiClient.setAuthToken('test-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      })

      await apiClient.request('/protected', 'GET')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })

    it('includes CSRF token for mutating operations', async () => {
      apiClient.setCsrfToken('csrf-token-123')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      })

      await apiClient.request('/update', 'POST', { data: 'test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-token-123'
          })
        })
      )
    })
  })

  describe('Error handling', () => {
    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch error'))

      await expect(apiClient.request('/test')).rejects.toThrow('Network error: Unable to connect to server')
    })

    it('handles empty responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('')
      })

      const result = await apiClient.request('/empty')
      expect(result).toBeNull()
    })
  })

  describe('Convenience function', () => {
    it('api function works as expected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"success": true}')
      })

      const result = await api('/test')
      expect(result).toEqual({ success: true })
    })
  })
})
