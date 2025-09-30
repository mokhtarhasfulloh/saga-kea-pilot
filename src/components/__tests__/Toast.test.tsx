import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast', () => {
  it('renders toast title and message', () => {
    const toastData = {
      id: '1',
      type: 'success' as const,
      title: 'Success',
      message: 'Operation completed successfully'
    }

    render(<Toast toast={toastData} onClose={vi.fn()} />)

    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const toastData = {
      id: 'test-id',
      type: 'info' as const,
      title: 'Info',
      message: 'Test message'
    }

    render(<Toast toast={toastData} onClose={onClose} />)

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledWith('test-id')
  })

  it('applies correct styling for success type', () => {
    const toastData = {
      id: '1',
      type: 'success' as const,
      title: 'Success',
      message: 'Success message'
    }

    render(<Toast toast={toastData} onClose={vi.fn()} />)

    const toast = screen.getByText('Success message').closest('div')
    expect(toast).toHaveClass('border-green-200')
  })

  it('applies correct styling for error type', () => {
    const toastData = {
      id: '1',
      type: 'error' as const,
      title: 'Error',
      message: 'Error message'
    }

    render(<Toast toast={toastData} onClose={vi.fn()} />)

    const toast = screen.getByText('Error message').closest('div')
    expect(toast).toHaveClass('border-red-200')
  })

  it('renders without message when only title provided', () => {
    const toastData = {
      id: '1',
      type: 'warning' as const,
      title: 'Warning'
    }

    render(<Toast toast={toastData} onClose={vi.fn()} />)

    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})
