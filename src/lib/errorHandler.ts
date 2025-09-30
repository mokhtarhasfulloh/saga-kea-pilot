import { ApiError } from './api'

export interface ErrorHandlerOptions {
  showToast?: boolean
  redirectOnAuth?: boolean
  retryable?: boolean
}

export interface ErrorInfo {
  title: string
  message: string
  severity: 'error' | 'warning' | 'info'
  retryable: boolean
  shouldRedirect: boolean
}

/**
 * Global error handler for API responses
 * Provides consistent error handling across the application
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private toastHandler?: (error: ErrorInfo) => void
  private redirectHandler?: (path: string) => void

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  setToastHandler(handler: (error: ErrorInfo) => void) {
    this.toastHandler = handler
  }

  setRedirectHandler(handler: (path: string) => void) {
    this.redirectHandler = handler
  }

  handleError(error: any, options: ErrorHandlerOptions = {}): ErrorInfo {
    const {
      showToast = true,
      redirectOnAuth = true,
      // retryable = false
    } = options

    const errorInfo = this.parseError(error)

    // Handle authentication errors
    if (error.status === 401 && redirectOnAuth && this.redirectHandler) {
      this.redirectHandler('/login')
      return errorInfo
    }

    // Show toast notification if requested
    if (showToast && this.toastHandler) {
      this.toastHandler(errorInfo)
    }

    return errorInfo
  }

  private parseError(error: any): ErrorInfo {
    if (error instanceof Error && 'status' in error) {
      const apiError = error as ApiError
      return this.parseApiError(apiError)
    }

    // Generic error
    return {
      title: 'Unexpected Error',
      message: error.message || 'An unexpected error occurred',
      severity: 'error',
      retryable: false,
      shouldRedirect: false
    }
  }

  private parseApiError(error: ApiError): ErrorInfo {
    switch (error.status) {
      case 0:
        return {
          title: 'Network Error',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          severity: 'error',
          retryable: true,
          shouldRedirect: false
        }

      case 401:
        return {
          title: 'Authentication Required',
          message: 'Your session has expired. Please log in again.',
          severity: 'warning',
          retryable: false,
          shouldRedirect: true
        }

      case 403:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to perform this action. Contact your administrator if you believe this is an error.',
          severity: 'warning',
          retryable: false,
          shouldRedirect: false
        }

      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          severity: 'error',
          retryable: false,
          shouldRedirect: false
        }

      case 409:
        return {
          title: 'Conflict',
          message: 'The request conflicts with the current state. Please refresh and try again.',
          severity: 'warning',
          retryable: true,
          shouldRedirect: false
        }

      case 422:
        return {
          title: 'Validation Error',
          message: error.data?.message || 'The submitted data is invalid. Please check your input and try again.',
          severity: 'warning',
          retryable: false,
          shouldRedirect: false
        }

      case 429:
        return {
          title: 'Rate Limit Exceeded',
          message: 'Too many requests. Please wait a moment before trying again.',
          severity: 'warning',
          retryable: true,
          shouldRedirect: false
        }

      case 500:
        return {
          title: 'Server Error',
          message: 'An internal server error occurred. Please try again later or contact support if the problem persists.',
          severity: 'error',
          retryable: true,
          shouldRedirect: false
        }

      case 502:
      case 503:
      case 504:
        return {
          title: 'Service Unavailable',
          message: 'The service is temporarily unavailable. Please try again in a few minutes.',
          severity: 'error',
          retryable: true,
          shouldRedirect: false
        }

      default:
        return {
          title: `HTTP ${error.status}`,
          message: error.data?.message || error.message || 'An error occurred while processing your request.',
          severity: 'error',
          retryable: error.status >= 500,
          shouldRedirect: false
        }
    }
  }

  // Utility method to determine if an error is retryable
  static isRetryable(error: any): boolean {
    if (error instanceof Error && 'status' in error) {
      const status = (error as ApiError).status
      return status === 0 || status === 409 || status === 429 || status >= 500
    }
    return false
  }

  // Utility method to get retry delay based on error type
  static getRetryDelay(error: any, attempt: number = 1): number {
    if (error instanceof Error && 'status' in error) {
      const status = (error as ApiError).status
      
      switch (status) {
        case 429: // Rate limit
          return Math.min(1000 * Math.pow(2, attempt), 30000) // Exponential backoff, max 30s
        case 0: // Network error
          return Math.min(1000 * attempt, 10000) // Linear backoff, max 10s
        default:
          return Math.min(1000 * Math.pow(2, attempt), 15000) // Exponential backoff, max 15s
      }
    }
    
    return 1000 * attempt // Default linear backoff
  }
}

// Export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance()
