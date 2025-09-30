import React, { createContext, useContext, useEffect, ReactNode, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalErrorHandler, ErrorInfo } from '../lib/errorHandler'
import { useToast } from '../components/Toast'

interface ErrorContextType {
  handleError: (error: any, options?: any) => ErrorInfo
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    // Set up global error handlers
    globalErrorHandler.setToastHandler((errorInfo: ErrorInfo) => {
      switch (errorInfo.severity) {
        case 'error':
          toast.error(errorInfo.title, errorInfo.message)
          break
        case 'warning':
          toast.warning(errorInfo.title, errorInfo.message)
          break
        case 'info':
          toast.info(errorInfo.title, errorInfo.message)
          break
      }
    })

    globalErrorHandler.setRedirectHandler((path: string) => {
      navigate(path, { replace: true })
    })
  }, [toast, navigate])

  const handleError = (error: any, options?: any): ErrorInfo => {
    return globalErrorHandler.handleError(error, options)
  }

  const value: ErrorContextType = {
    handleError
  }

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useErrorHandler(): ErrorContextType {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useErrorHandler must be used within an ErrorProvider')
  }
  return context
}

// Hook for handling API errors with retry functionality
export function useApiErrorHandler() {
  const { handleError } = useErrorHandler()

  const handleApiError = (error: any, options?: {
    showToast?: boolean
    redirectOnAuth?: boolean
    onRetry?: () => void
  }) => {
    const errorInfo = handleError(error, options)
    
    // Return error info with retry capability
    return {
      ...errorInfo,
      retry: options?.onRetry && errorInfo.retryable ? options.onRetry : undefined
    }
  }

  return { handleApiError }
}

// Higher-order component for error boundary
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo)
    
    // Report error to global handler
    globalErrorHandler.handleError(error, { showToast: true })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              An unexpected error occurred. Please refresh the page or contact support.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
